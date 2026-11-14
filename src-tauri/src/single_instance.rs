use std::fs::{self, OpenOptions};
use std::io::{BufRead, BufReader, ErrorKind, Write};
use std::net::{SocketAddr, TcpListener, TcpStream};
use std::path::{Path, PathBuf};
use std::time::Duration;

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

const LOCK_FILE: &str = "single-instance.json";
const CONNECT_TIMEOUT: Duration = Duration::from_millis(500);
const IO_TIMEOUT: Duration = Duration::from_secs(3);
const MAX_CLAIM_ATTEMPTS: usize = 8;
const RETRY_DELAY: Duration = Duration::from_millis(60);

pub enum Claim {
    Primary(PrimaryInstance),
    Secondary,
    Unavailable,
}

pub struct PrimaryInstance {
    listener: TcpListener,
    token: String,
    lock_path: PathBuf,
}

#[derive(Serialize, Deserialize)]
struct LockInfo {
    token: String,
    port: u16,
}

#[derive(Serialize, Deserialize)]
struct Handoff {
    token: String,
    path: Option<String>,
}

#[derive(Serialize, Deserialize)]
struct Ack {
    ok: bool,
}

impl Drop for PrimaryInstance {
    fn drop(&mut self) {
        let _ = fs::remove_file(&self.lock_path);
    }
}

/**
 * Resolves the per-user application data directory that matches Tauri's
 * `app_data_dir`: `%APPDATA%/<identifier>` on Windows and
 * `$XDG_DATA_HOME/<identifier>` or `~/.local/share/<identifier>` on Linux.
 */
pub fn data_dir(identifier: &str) -> Option<PathBuf> {
    #[cfg(target_os = "windows")]
    {
        std::env::var_os("APPDATA")
            .map(PathBuf::from)
            .map(|base| base.join(identifier))
    }
    #[cfg(target_os = "linux")]
    {
        if let Some(xdg) = std::env::var_os("XDG_DATA_HOME") {
            let path = PathBuf::from(xdg);
            if !path.as_os_str().is_empty() {
                return Some(path.join(identifier));
            }
        }
        std::env::var_os("HOME")
            .map(PathBuf::from)
            .map(|home| home.join(".local").join("share").join(identifier))
    }
    #[cfg(not(any(target_os = "windows", target_os = "linux")))]
    {
        let _ = identifier;
        None
    }
}

/**
 * Claims the running instance. The secondary path forwards the requested file
 * (or just the focus request) and returns `Secondary` so the caller can exit
 * before creating a window. Failures degrade to `Unavailable` rather than
 * preventing the editor from starting.
 */
pub fn claim(app_data_dir: &Path, startup_file: Option<&str>) -> Claim {
    if fs::create_dir_all(app_data_dir).is_err() {
        return Claim::Unavailable;
    }
    let lock_path = app_data_dir.join(LOCK_FILE);
    if forward(&lock_path, startup_file) {
        return Claim::Secondary;
    }

    let listener = match TcpListener::bind(("127.0.0.1", 0)) {
        Ok(listener) => listener,
        Err(_) => return Claim::Unavailable,
    };
    let port = match listener.local_addr() {
        Ok(address) => address.port(),
        Err(_) => return Claim::Unavailable,
    };
    let token = generate_token();

    for _ in 0..MAX_CLAIM_ATTEMPTS {
        match write_lock(&lock_path, &token, port) {
            Ok(()) => {
                return Claim::Primary(PrimaryInstance {
                    listener,
                    token,
                    lock_path,
                })
            }
            Err(error) if error.kind() == ErrorKind::AlreadyExists => {
                if forward(&lock_path, startup_file) {
                    return Claim::Secondary;
                }
                std::thread::sleep(RETRY_DELAY);
            }
            Err(_) => return Claim::Unavailable,
        }
    }

    let _ = fs::remove_file(&lock_path);
    match write_lock(&lock_path, &token, port) {
        Ok(()) => Claim::Primary(PrimaryInstance {
            listener,
            token,
            lock_path,
        }),
        Err(_) => Claim::Unavailable,
    }
}

impl PrimaryInstance {
    /** Starts the listener thread. The callback runs for each accepted handoff. */
    pub fn start<F>(self, on_open: F) -> std::io::Result<()>
    where
        F: Fn(Option<String>) + Send + 'static,
    {
        std::thread::Builder::new()
            .name("marksi-single-instance".to_string())
            .spawn(move || {
                for stream in self.listener.incoming() {
                    if let Ok(mut stream) = stream {
                        let _ = serve(&mut stream, &self.token, &on_open);
                    }
                }
            })?;
        Ok(())
    }
}

fn forward(lock_path: &Path, startup_file: Option<&str>) -> bool {
    let info = match fs::read_to_string(lock_path)
        .ok()
        .and_then(|text| serde_json::from_str::<LockInfo>(&text).ok())
    {
        Some(info) => info,
        None => return false,
    };
    let address = SocketAddr::from(([127, 0, 0, 1], info.port));
    let mut stream = match TcpStream::connect_timeout(&address, CONNECT_TIMEOUT) {
        Ok(stream) => stream,
        Err(_) => return false,
    };
    if stream.set_read_timeout(Some(IO_TIMEOUT)).is_err()
        || stream.set_write_timeout(Some(IO_TIMEOUT)).is_err()
    {
        return false;
    }
    let handoff = Handoff {
        token: info.token,
        path: startup_file.map(str::to_owned),
    };
    let payload = match serde_json::to_vec(&handoff) {
        Ok(payload) => payload,
        Err(_) => return false,
    };
    if stream.write_all(&payload).is_err()
        || stream.write_all(b"\n").is_err()
        || stream.flush().is_err()
    {
        return false;
    }
    let mut response = String::new();
    if BufReader::new(&mut stream)
        .read_line(&mut response)
        .is_err()
    {
        return false;
    }
    serde_json::from_str::<Ack>(response.trim())
        .map(|ack| ack.ok)
        .unwrap_or(false)
}

fn serve<F>(stream: &mut TcpStream, token: &str, on_open: &F) -> std::io::Result<()>
where
    F: Fn(Option<String>),
{
    stream.set_read_timeout(Some(IO_TIMEOUT))?;
    stream.set_write_timeout(Some(IO_TIMEOUT))?;
    let mut line = String::new();
    BufReader::new(&mut *stream).read_line(&mut line)?;
    let handoff: Handoff = match serde_json::from_str(line.trim()) {
        Ok(handoff) => handoff,
        Err(_) => {
            write_ack(stream, false)?;
            return Ok(());
        }
    };
    if handoff.token != token {
        write_ack(stream, false)?;
        return Ok(());
    }
    let path = handoff.path.filter(|path| valid_file_path(path));
    write_ack(stream, true)?;
    on_open(path);
    Ok(())
}

fn valid_file_path(path: &str) -> bool {
    let path = Path::new(path);
    path.is_file() && crate::commands::workspace::is_text_file(path)
}

fn write_lock(path: &Path, token: &str, port: u16) -> std::io::Result<()> {
    let mut file = OpenOptions::new().write(true).create_new(true).open(path)?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(path, fs::Permissions::from_mode(0o600))?;
    }
    let info = LockInfo {
        token: token.to_string(),
        port,
    };
    serde_json::to_writer(&mut file, &info)
        .map_err(|error| std::io::Error::new(ErrorKind::InvalidData, error))?;
    file.write_all(b"\n")?;
    file.sync_all()?;
    Ok(())
}

fn write_ack(stream: &mut TcpStream, ok: bool) -> std::io::Result<()> {
    let payload = serde_json::to_vec(&Ack { ok })
        .map_err(|error| std::io::Error::new(ErrorKind::InvalidData, error))?;
    stream.write_all(&payload)?;
    stream.write_all(b"\n")?;
    stream.flush()
}

fn generate_token() -> String {
    let mut hasher = Sha256::new();
    hasher.update(std::process::id().to_le_bytes());
    if let Ok(elapsed) = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH) {
        hasher.update(elapsed.as_nanos().to_le_bytes());
    }
    if let Ok(executable) = std::env::current_exe() {
        hasher.update(executable.to_string_lossy().as_bytes());
    }
    hasher
        .finalize()
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::mpsc;

    fn note_fixture(directory: &Path) -> PathBuf {
        let note = directory.join("forwarded.md");
        fs::write(&note, "# Forwarded\n").expect("write note");
        note
    }

    #[test]
    fn forwards_a_file_to_the_primary_instance() {
        let directory = tempfile::tempdir().expect("tempdir");
        let note = note_fixture(directory.path());
        let primary = match claim(directory.path(), None) {
            Claim::Primary(primary) => primary,
            _ => panic!("first claim should be primary"),
        };
        let (sender, receiver) = mpsc::channel();
        primary
            .start(move |path| {
                let _ = sender.send(path);
            })
            .expect("start listener");

        let second = claim(directory.path(), Some(note.to_str().expect("utf8 path")));
        assert!(matches!(second, Claim::Secondary));
        let received = receiver
            .recv_timeout(Duration::from_secs(2))
            .expect("handoff");
        assert_eq!(received.as_deref(), Some(note.to_str().expect("utf8 path")));
    }

    #[test]
    fn focus_only_handoff_has_no_path() {
        let directory = tempfile::tempdir().expect("tempdir");
        let primary = match claim(directory.path(), None) {
            Claim::Primary(primary) => primary,
            _ => panic!("first claim should be primary"),
        };
        let (sender, receiver) = mpsc::channel();
        primary
            .start(move |path| {
                let _ = sender.send(path);
            })
            .expect("start listener");

        let second = claim(directory.path(), None);
        assert!(matches!(second, Claim::Secondary));
        assert_eq!(
            receiver
                .recv_timeout(Duration::from_secs(2))
                .expect("handoff"),
            None
        );
    }

    #[test]
    fn replaces_a_stale_lock() {
        let directory = tempfile::tempdir().expect("tempdir");
        fs::write(
            directory.path().join(LOCK_FILE),
            r#"{"token":"stale","port":0}"#,
        )
        .expect("stale lock");
        assert!(matches!(claim(directory.path(), None), Claim::Primary(_)));
    }
}
