use std::fs;
use std::io::{self, Write};
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

use chardetng::EncodingDetector;
use encoding_rs::{Encoding, UTF_8};
use serde::Serialize;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DocumentPayload {
    path: String,
    content: String,
    encoding: String,
    line_ending: String,
    has_bom: bool,
    had_errors: bool,
    size: u64,
    modified_ms: Option<u64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileMeta {
    path: String,
    size: u64,
    modified_ms: Option<u64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileEntry {
    name: String,
    path: String,
    is_dir: bool,
    size: u64,
    modified_ms: Option<u64>,
}

#[tauri::command]
pub fn read_document(path: String) -> Result<DocumentPayload, String> {
    let requested = PathBuf::from(&path);
    let target = dunce::canonicalize(&requested)
        .map_err(|error| format!("Cannot open {}: {error}", requested.display()))?;

    if !target.is_file() {
        return Err(format!("{} is not a file", target.display()));
    }

    let bytes =
        fs::read(&target).map_err(|error| format!("Cannot read {}: {error}", target.display()))?;
    let (content, encoding, has_bom, had_errors) = decode_bytes(&bytes);
    let (normalized, line_ending) = normalize_line_endings(&content);
    let metadata = fs::metadata(&target)
        .map_err(|error| format!("Cannot inspect {}: {error}", target.display()))?;

    Ok(DocumentPayload {
        path: target.to_string_lossy().into_owned(),
        content: normalized,
        encoding: encoding.name().to_string(),
        line_ending,
        has_bom,
        had_errors,
        size: metadata.len(),
        modified_ms: modified_ms(&metadata),
    })
}

#[tauri::command]
pub fn write_document(
    path: String,
    content: String,
    encoding: String,
    line_ending: String,
    has_bom: bool,
) -> Result<FileMeta, String> {
    let target = resolve_write_target(Path::new(&path))?;
    let normalized = normalize_newlines(&content);
    let encoded = encode_text(
        &normalized,
        &encoding,
        line_ending.eq_ignore_ascii_case("CRLF"),
        has_bom,
    )?;

    let parent = target
        .parent()
        .ok_or_else(|| format!("{} has no parent directory", target.display()))?;
    if !parent.is_dir() {
        return Err(format!("{} is not a directory", parent.display()));
    }

    // Write to a sibling temporary file, sync it, then replace the target. This
    // keeps a failed write from truncating an existing document.
    let mut temp = tempfile::Builder::new()
        .prefix(".marksi-")
        .suffix(".tmp")
        .tempfile_in(parent)
        .map_err(|error| format!("Cannot create a temporary file: {error}"))?;
    temp.as_file_mut()
        .write_all(&encoded)
        .map_err(|error| format!("Cannot write temporary file: {error}"))?;
    temp.as_file()
        .sync_all()
        .map_err(|error| format!("Cannot flush temporary file: {error}"))?;

    if let Ok(metadata) = fs::metadata(&target) {
        let _ = fs::set_permissions(temp.path(), metadata.permissions());
    }

    let temp_path = temp
        .into_temp_path()
        .keep()
        .map_err(|error| format!("Cannot prepare temporary file: {error}"))?;

    if let Err(error) = replace_file(&temp_path, &target) {
        let _ = fs::remove_file(&temp_path);
        return Err(format!("Cannot save {}: {error}", target.display()));
    }

    let metadata = fs::metadata(&target)
        .map_err(|error| format!("Cannot inspect {} after save: {error}", target.display()))?;

    Ok(FileMeta {
        path: target.to_string_lossy().into_owned(),
        size: metadata.len(),
        modified_ms: modified_ms(&metadata),
    })
}

#[tauri::command]
pub fn list_directory(path: String) -> Result<Vec<FileEntry>, String> {
    let root = dunce::canonicalize(Path::new(&path))
        .map_err(|error| format!("Cannot open folder {}: {error}", path))?;

    if !root.is_dir() {
        return Err(format!("{} is not a folder", root.display()));
    }

    let mut entries = Vec::new();
    let directory = fs::read_dir(&root)
        .map_err(|error| format!("Cannot read folder {}: {error}", root.display()))?;

    for entry in directory {
        let entry = match entry {
            Ok(entry) => entry,
            Err(_) => continue,
        };
        let name = entry.file_name().to_string_lossy().into_owned();
        if should_skip(&name) {
            continue;
        }
        let entry_path = entry.path();
        let metadata = match entry.metadata() {
            Ok(metadata) => metadata,
            Err(_) => continue,
        };
        entries.push(FileEntry {
            name,
            path: entry_path.to_string_lossy().into_owned(),
            is_dir: metadata.is_dir(),
            size: if metadata.is_file() {
                metadata.len()
            } else {
                0
            },
            modified_ms: modified_ms(&metadata),
        });
    }

    entries.sort_by(|left, right| {
        right
            .is_dir
            .cmp(&left.is_dir)
            .then_with(|| left.name.to_lowercase().cmp(&right.name.to_lowercase()))
    });

    Ok(entries)
}

#[tauri::command]
pub fn app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

fn decode_bytes(bytes: &[u8]) -> (String, &'static Encoding, bool, bool) {
    if let Some((encoding, _)) = Encoding::for_bom(bytes) {
        let (decoded, _, had_errors) = encoding.decode(bytes);
        return (decoded.into_owned(), encoding, true, had_errors);
    }

    let mut detector = EncodingDetector::new();
    detector.feed(bytes, true);
    let encoding = detector.guess(None, true);
    let (decoded, _, had_errors) = encoding.decode(bytes);
    (decoded.into_owned(), encoding, false, had_errors)
}

fn encode_text(
    content: &str,
    encoding_label: &str,
    crlf: bool,
    has_bom: bool,
) -> Result<Vec<u8>, String> {
    let text = if crlf {
        content.replace('\n', "\r\n")
    } else {
        content.to_string()
    };

    let encoding = Encoding::for_label(encoding_label.as_bytes()).unwrap_or(UTF_8);
    let name = encoding.name();

    if name.eq_ignore_ascii_case("UTF-16LE") || name.eq_ignore_ascii_case("UTF-16BE") {
        let little_endian = name.eq_ignore_ascii_case("UTF-16LE");
        let mut output = Vec::with_capacity(text.len() * 2 + 2);
        if has_bom {
            output.extend_from_slice(if little_endian {
                &[0xFF, 0xFE]
            } else {
                &[0xFE, 0xFF]
            });
        }
        for unit in text.encode_utf16() {
            let bytes = if little_endian {
                unit.to_le_bytes()
            } else {
                unit.to_be_bytes()
            };
            output.extend_from_slice(&bytes);
        }
        return Ok(output);
    }

    let (encoded, _, had_errors) = encoding.encode(&text);
    if had_errors {
        return Err(format!(
            "Some characters cannot be represented in {name}. Save the file as UTF-8 instead."
        ));
    }

    let mut output = encoded.into_owned();
    if has_bom && name.eq_ignore_ascii_case("UTF-8") {
        output.splice(0..0, [0xEF, 0xBB, 0xBF]);
    }
    Ok(output)
}

fn normalize_newlines(content: &str) -> String {
    content.replace("\r\n", "\n").replace('\r', "\n")
}

fn normalize_line_endings(content: &str) -> (String, String) {
    let crlf = content.matches("\r\n").count();
    let lf = content.matches('\n').count().saturating_sub(crlf);
    let line_ending = if crlf > 0 && crlf >= lf { "CRLF" } else { "LF" };
    (normalize_newlines(content), line_ending.to_string())
}

fn resolve_write_target(path: &Path) -> Result<PathBuf, String> {
    if path.exists() {
        return dunce::canonicalize(path)
            .map_err(|error| format!("Cannot resolve {}: {error}", path.display()));
    }

    let parent = path
        .parent()
        .ok_or_else(|| format!("{} has no parent directory", path.display()))?;
    let parent = dunce::canonicalize(parent)
        .map_err(|error| format!("Cannot resolve destination folder: {error}"))?;
    let name = path
        .file_name()
        .ok_or_else(|| format!("{} has no file name", path.display()))?;
    Ok(parent.join(name))
}

fn modified_ms(metadata: &fs::Metadata) -> Option<u64> {
    metadata
        .modified()
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_millis() as u64)
}

fn should_skip(name: &str) -> bool {
    matches!(
        name,
        ".git"
            | ".hg"
            | ".svn"
            | "node_modules"
            | "target"
            | ".DS_Store"
            | "Thumbs.db"
            | "desktop.ini"
    )
}

#[cfg(windows)]
fn replace_file(source: &Path, destination: &Path) -> io::Result<()> {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Storage::FileSystem::{
        MoveFileExW, MOVEFILE_REPLACE_EXISTING, MOVEFILE_WRITE_THROUGH,
    };

    let source: Vec<u16> = source
        .as_os_str()
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();
    let destination: Vec<u16> = destination
        .as_os_str()
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();

    let result = unsafe {
        MoveFileExW(
            source.as_ptr(),
            destination.as_ptr(),
            MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH,
        )
    };

    if result == 0 {
        Err(io::Error::last_os_error())
    } else {
        Ok(())
    }
}

#[cfg(not(windows))]
fn replace_file(source: &Path, destination: &Path) -> io::Result<()> {
    fs::rename(source, destination)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn round_trips_utf8_and_crlf() {
        let directory = tempfile::tempdir().expect("tempdir");
        let path = directory.path().join("note.md");
        let path_string = path.to_string_lossy().into_owned();

        let meta = write_document(
            path_string.clone(),
            "# Hello\n\nA line.\n".to_string(),
            "UTF-8".to_string(),
            "CRLF".to_string(),
            false,
        )
        .expect("write");

        assert!(meta.size > 0);
        assert_eq!(
            fs::read(&path).expect("read bytes"),
            b"# Hello\r\n\r\nA line.\r\n"
        );

        let payload = read_document(path_string).expect("read document");
        assert_eq!(payload.content, "# Hello\n\nA line.\n");
        assert_eq!(payload.encoding, "UTF-8");
        assert_eq!(payload.line_ending, "CRLF");
        assert!(!payload.has_bom);
        assert!(!payload.had_errors);
    }

    #[test]
    fn preserves_utf8_bom() {
        let directory = tempfile::tempdir().expect("tempdir");
        let path = directory.path().join("bom.md");
        let path_string = path.to_string_lossy().into_owned();

        write_document(
            path_string.clone(),
            "hello".to_string(),
            "UTF-8".to_string(),
            "LF".to_string(),
            true,
        )
        .expect("write");

        let bytes = fs::read(&path).expect("read bytes");
        assert_eq!(&bytes[..3], &[0xEF, 0xBB, 0xBF]);

        let payload = read_document(path_string).expect("read document");
        assert_eq!(payload.content, "hello");
        assert!(payload.has_bom);
    }

    #[test]
    fn replaces_existing_file_atomically_without_temp_files() {
        let directory = tempfile::tempdir().expect("tempdir");
        let path = directory.path().join("atomic.md");
        let path_string = path.to_string_lossy().into_owned();

        write_document(
            path_string.clone(),
            "first".to_string(),
            "UTF-8".to_string(),
            "LF".to_string(),
            false,
        )
        .expect("first write");
        write_document(
            path_string,
            "second".to_string(),
            "UTF-8".to_string(),
            "LF".to_string(),
            false,
        )
        .expect("second write");

        assert_eq!(fs::read_to_string(&path).expect("read"), "second");
        let leftovers = fs::read_dir(directory.path())
            .expect("directory")
            .filter_map(Result::ok)
            .filter(|entry| entry.file_name().to_string_lossy().starts_with(".marksi-"))
            .count();
        assert_eq!(leftovers, 0);
    }

    #[test]
    fn preserves_utf16le_bom() {
        let directory = tempfile::tempdir().expect("tempdir");
        let path = directory.path().join("utf16.md");
        let path_string = path.to_string_lossy().into_owned();

        write_document(
            path_string.clone(),
            "hello".to_string(),
            "UTF-16LE".to_string(),
            "LF".to_string(),
            true,
        )
        .expect("write");

        let bytes = fs::read(&path).expect("read bytes");
        assert_eq!(&bytes[..2], &[0xFF, 0xFE]);

        let payload = read_document(path_string).expect("read document");
        assert_eq!(payload.content, "hello");
        assert_eq!(payload.encoding, "UTF-16LE");
        assert!(payload.has_bom);
    }
}
