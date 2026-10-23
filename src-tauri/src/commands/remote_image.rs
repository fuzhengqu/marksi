use std::fs;
use std::net::{IpAddr, Ipv4Addr, Ipv6Addr, ToSocketAddrs};
use std::path::{Path, PathBuf};

use base64::{engine::general_purpose::STANDARD, Engine as _};
use sha2::{Digest, Sha256};
use tauri::Manager;
use url::Url;

use super::document::write_atomic;

const MAX_URL_LENGTH: usize = 4096;
const MAX_REMOTE_BYTES: usize = 10 * 1024 * 1024;

fn is_private_ip(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(address) => is_private_ipv4(address),
        IpAddr::V6(address) => is_private_ipv6(address),
    }
}

fn is_private_ipv4(address: Ipv4Addr) -> bool {
    let octets = address.octets();
    address.is_private()
        || address.is_loopback()
        || address.is_link_local()
        || address.is_unspecified()
        || address.is_broadcast()
        || address.is_multicast()
        || octets[0] == 0
        || (octets[0] == 100 && (64..=127).contains(&octets[1]))
        || (octets[0] == 192 && octets[1] == 0 && octets[2] == 0)
        || (octets[0] == 198 && (18..=19).contains(&octets[1]))
        || (octets[0] == 198 && octets[1] == 51 && octets[2] == 100)
        || (octets[0] == 203 && octets[1] == 0 && octets[2] == 113)
        || octets[0] >= 240
}

fn is_private_ipv6(address: Ipv6Addr) -> bool {
    if let Some(mapped) = address.to_ipv4_mapped() {
        return is_private_ipv4(mapped);
    }
    address.is_loopback()
        || address.is_unspecified()
        || address.is_multicast()
        || address.is_unique_local()
        || address.is_unicast_link_local()
        || (address.segments()[0] == 0x2001 && address.segments()[1] == 0x0db8)
}

fn validate_remote_url(value: &str, allow_private: bool) -> Result<Url, String> {
    if value.len() > MAX_URL_LENGTH {
        return Err("Remote image URL is too long.".to_string());
    }
    let url = Url::parse(value).map_err(|error| format!("Invalid remote image URL: {error}"))?;
    if !matches!(url.scheme(), "http" | "https") {
        return Err("Remote images must use http or https.".to_string());
    }
    if !url.username().is_empty() || url.password().is_some() {
        return Err("Remote image URLs must not contain credentials.".to_string());
    }
    let host = url
        .host_str()
        .ok_or_else(|| "Remote image URL has no host.".to_string())?;
    if !allow_private {
        let lower = host.to_ascii_lowercase();
        if lower == "localhost" || lower.ends_with(".localhost") || lower.ends_with(".local") {
            return Err("Remote image URL points to a local host.".to_string());
        }
        let ip_host = host.trim_start_matches('[').trim_end_matches(']');
        if let Ok(ip) = ip_host.parse::<IpAddr>() {
            if is_private_ip(ip) {
                return Err("Remote image URL points to a private address.".to_string());
            }
        }
    }
    Ok(url)
}

fn ensure_public_host(url: &Url) -> Result<(), String> {
    let host = url
        .host_str()
        .ok_or_else(|| "Remote image URL has no host.".to_string())?;
    let ip_host = host.trim_start_matches('[').trim_end_matches(']');
    if ip_host.parse::<IpAddr>().is_ok() {
        return Ok(());
    }
    let port = url
        .port_or_known_default()
        .ok_or_else(|| "Remote image URL has no port.".to_string())?;
    let addresses = (host, port)
        .to_socket_addrs()
        .map_err(|error| format!("Cannot resolve remote image host: {error}"))?;
    for address in addresses {
        if is_private_ip(address.ip()) {
            return Err("Remote image host resolves to a private address.".to_string());
        }
    }
    Ok(())
}

fn image_mime(content_type: &str, bytes: &[u8]) -> Option<&'static str> {
    let declared = content_type
        .split(';')
        .next()
        .unwrap_or("")
        .trim()
        .to_ascii_lowercase();
    if declared.starts_with("image/") {
        return match declared.as_str() {
            "image/png" => Some("image/png"),
            "image/jpeg" | "image/jpg" => Some("image/jpeg"),
            "image/gif" => Some("image/gif"),
            "image/webp" => Some("image/webp"),
            "image/svg+xml" => Some("image/svg+xml"),
            "image/bmp" => Some("image/bmp"),
            "image/avif" => Some("image/avif"),
            "image/x-icon" | "image/vnd.microsoft.icon" => Some("image/x-icon"),
            _ => None,
        };
    }

    if bytes.starts_with(&[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]) {
        Some("image/png")
    } else if bytes.starts_with(&[0xFF, 0xD8, 0xFF]) {
        Some("image/jpeg")
    } else if bytes.starts_with(b"GIF87a") || bytes.starts_with(b"GIF89a") {
        Some("image/gif")
    } else if bytes.len() >= 12 && &bytes[..4] == b"RIFF" && &bytes[8..12] == b"WEBP" {
        Some("image/webp")
    } else if bytes.starts_with(b"BM") {
        Some("image/bmp")
    } else {
        let text = String::from_utf8_lossy(&bytes[..bytes.len().min(512)]);
        let trimmed = text.trim_start();
        if trimmed.starts_with("<svg") || (trimmed.starts_with("<?xml") && trimmed.contains("<svg"))
        {
            Some("image/svg+xml")
        } else {
            None
        }
    }
}

fn cache_key(url: &str) -> String {
    format!("{:x}", Sha256::digest(url.as_bytes()))
}

fn cache_file(directory: &Path, url: &str) -> PathBuf {
    directory.join(format!("{}.bin", cache_key(url)))
}

fn data_url(bytes: &[u8], mime: &str) -> String {
    format!("data:{mime};base64,{}", STANDARD.encode(bytes))
}

fn read_cache(directory: &Path, url: &str) -> Option<String> {
    let path = cache_file(directory, url);
    let bytes = fs::read(path).ok()?;
    if bytes.is_empty() || bytes.len() > MAX_REMOTE_BYTES {
        return None;
    }
    let mime = image_mime("", &bytes)?;
    Some(data_url(&bytes, mime))
}

#[cfg(not(windows))]
fn fetch_remote_image_with_policy(
    url: &str,
    allow_private: bool,
) -> Result<(Vec<u8>, &'static str), String> {
    let parsed = validate_remote_url(url, allow_private)?;
    if !allow_private {
        ensure_public_host(&parsed)?;
    }
    let output = std::process::Command::new("curl")
        .args([
            "--fail",
            "--silent",
            "--show-error",
            "--max-time",
            "20",
            "--max-filesize",
            "10485760",
            "--output",
            "-",
            url,
        ])
        .output()
        .map_err(|error| format!("Cannot start curl: {error}"))?;
    if !output.status.success() {
        return Err(format!(
            "Cannot download remote image: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }
    if output.stdout.len() > MAX_REMOTE_BYTES {
        return Err("Remote image is larger than 10 MB.".to_string());
    }
    if output.stdout.is_empty() {
        return Err("Remote image is empty.".to_string());
    }
    let mime = image_mime("", &output.stdout)
        .ok_or_else(|| "Remote resource is not a supported image.".to_string())?;
    Ok((output.stdout, mime))
}

#[cfg(windows)]
fn to_wide(value: &str) -> Vec<u16> {
    value.encode_utf16().chain(std::iter::once(0)).collect()
}

#[cfg(windows)]
fn win_error(action: &str) -> String {
    format!("{action} failed: {}", std::io::Error::last_os_error())
}

#[cfg(windows)]
struct WinHandle(*mut std::ffi::c_void);

#[cfg(windows)]
impl Drop for WinHandle {
    fn drop(&mut self) {
        unsafe {
            windows_sys::Win32::Networking::WinHttp::WinHttpCloseHandle(self.0);
        }
    }
}

#[cfg(windows)]
unsafe fn query_header_string(handle: *mut std::ffi::c_void, level: u32) -> Option<String> {
    use std::ptr::null;
    use windows_sys::Win32::Networking::WinHttp::WinHttpQueryHeaders;

    let mut length = 0_u32;
    WinHttpQueryHeaders(
        handle,
        level,
        null(),
        null::<std::ffi::c_void>() as *mut _,
        &mut length,
        null::<u32>() as *mut _,
    );
    if length == 0 {
        return None;
    }
    let mut buffer = vec![0_u16; (length as usize + 1) / 2 + 1];
    let mut length_bytes = (buffer.len() * 2) as u32;
    if WinHttpQueryHeaders(
        handle,
        level,
        null(),
        buffer.as_mut_ptr() as *mut _,
        &mut length_bytes,
        null::<u32>() as *mut _,
    ) == 0
    {
        return None;
    }
    let end = buffer
        .iter()
        .position(|value| *value == 0)
        .unwrap_or(buffer.len());
    Some(String::from_utf16_lossy(&buffer[..end]))
}

#[cfg(windows)]
unsafe fn query_header_u32(handle: *mut std::ffi::c_void, level: u32) -> Option<u32> {
    use std::ptr::null;
    use windows_sys::Win32::Networking::WinHttp::{WinHttpQueryHeaders, WINHTTP_QUERY_FLAG_NUMBER};

    let mut value = 0_u32;
    let mut length = std::mem::size_of::<u32>() as u32;
    if WinHttpQueryHeaders(
        handle,
        level | WINHTTP_QUERY_FLAG_NUMBER,
        null(),
        &mut value as *mut _ as *mut _,
        &mut length,
        null::<u32>() as *mut _,
    ) == 0
    {
        None
    } else {
        Some(value)
    }
}

#[cfg(windows)]
fn fetch_remote_image_with_policy(
    url: &str,
    allow_private: bool,
) -> Result<(Vec<u8>, &'static str), String> {
    use std::ffi::c_void;
    use std::ptr::null;
    use windows_sys::Win32::Networking::WinHttp::{
        WinHttpConnect, WinHttpOpen, WinHttpOpenRequest, WinHttpReadData, WinHttpReceiveResponse,
        WinHttpSendRequest, WinHttpSetOption, WinHttpSetTimeouts,
        WINHTTP_ACCESS_TYPE_DEFAULT_PROXY, WINHTTP_FLAG_SECURE, WINHTTP_OPTION_REDIRECT_POLICY,
        WINHTTP_OPTION_REDIRECT_POLICY_NEVER, WINHTTP_QUERY_CONTENT_LENGTH,
        WINHTTP_QUERY_CONTENT_TYPE, WINHTTP_QUERY_STATUS_CODE,
    };

    let parsed = validate_remote_url(url, allow_private)?;
    if !allow_private {
        ensure_public_host(&parsed)?;
    }
    let host = parsed
        .host_str()
        .ok_or_else(|| "Remote image URL has no host.".to_string())?;
    let port = parsed
        .port_or_known_default()
        .ok_or_else(|| "Remote image URL has no port.".to_string())?;
    let port = u16::try_from(port).map_err(|_| "Remote image port is invalid.".to_string())?;
    let secure = parsed.scheme() == "https";
    let mut object = parsed.path().to_string();
    if object.is_empty() {
        object.push('/');
    }
    if let Some(query) = parsed.query() {
        object.push('?');
        object.push_str(query);
    }

    let agent = to_wide("MarkSI");
    let host = to_wide(host);
    let object = to_wide(&object);
    let verb = to_wide("GET");
    let policy: u32 = WINHTTP_OPTION_REDIRECT_POLICY_NEVER;

    unsafe {
        let session = WinHttpOpen(
            agent.as_ptr(),
            WINHTTP_ACCESS_TYPE_DEFAULT_PROXY,
            null(),
            null(),
            0,
        );
        if session.is_null() {
            return Err(win_error("WinHttpOpen"));
        }
        let session = WinHandle(session);
        let _ = WinHttpSetTimeouts(session.0, 10_000, 10_000, 20_000, 20_000);

        let connection = WinHttpConnect(session.0, host.as_ptr(), port, 0);
        if connection.is_null() {
            return Err(win_error("WinHttpConnect"));
        }
        let connection = WinHandle(connection);
        let request = WinHttpOpenRequest(
            connection.0,
            verb.as_ptr(),
            object.as_ptr(),
            null(),
            null(),
            null(),
            if secure { WINHTTP_FLAG_SECURE } else { 0 },
        );
        if request.is_null() {
            return Err(win_error("WinHttpOpenRequest"));
        }
        let request = WinHandle(request);
        let _ = WinHttpSetOption(
            request.0,
            WINHTTP_OPTION_REDIRECT_POLICY,
            &policy as *const u32 as *const c_void,
            std::mem::size_of::<u32>() as u32,
        );

        if WinHttpSendRequest(request.0, null(), 0, null(), 0, 0, 0) == 0 {
            return Err(win_error("WinHttpSendRequest"));
        }
        if WinHttpReceiveResponse(request.0, null::<c_void>() as *mut _) == 0 {
            return Err(win_error("WinHttpReceiveResponse"));
        }

        let status = query_header_u32(request.0, WINHTTP_QUERY_STATUS_CODE).unwrap_or(0);
        if status != 200 {
            return Err(format!("Remote image request failed with HTTP {status}."));
        }
        if let Some(length) = query_header_u32(request.0, WINHTTP_QUERY_CONTENT_LENGTH) {
            if length as usize > MAX_REMOTE_BYTES {
                return Err("Remote image is larger than 10 MB.".to_string());
            }
        }
        let content_type =
            query_header_string(request.0, WINHTTP_QUERY_CONTENT_TYPE).unwrap_or_default();
        let mut bytes = Vec::new();
        loop {
            let mut buffer = [0_u8; 8192];
            let mut read = 0_u32;
            if WinHttpReadData(
                request.0,
                buffer.as_mut_ptr() as *mut c_void,
                buffer.len() as u32,
                &mut read,
            ) == 0
            {
                return Err(win_error("WinHttpReadData"));
            }
            if read == 0 {
                break;
            }
            if bytes.len() + read as usize > MAX_REMOTE_BYTES {
                return Err("Remote image is larger than 10 MB.".to_string());
            }
            bytes.extend_from_slice(&buffer[..read as usize]);
        }
        if bytes.is_empty() {
            return Err("Remote image is empty.".to_string());
        }
        let mime = image_mime(&content_type, &bytes)
            .ok_or_else(|| "Remote resource is not a supported image.".to_string())?;
        Ok((bytes, mime))
    }
}

fn load_or_fetch(directory: &Path, url: &str) -> Result<String, String> {
    if let Some(cached) = read_cache(directory, url) {
        return Ok(cached);
    }
    let (bytes, mime) = fetch_remote_image_with_policy(url, false)?;
    let path = cache_file(directory, url);
    write_atomic(&path, &bytes)?;
    Ok(data_url(&bytes, mime))
}

fn remote_cache_directory(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let directory = app
        .path()
        .app_cache_dir()
        .map_err(|error| format!("Cannot resolve the app cache folder: {error}"))?
        .join("remote-images");
    fs::create_dir_all(&directory)
        .map_err(|error| format!("Cannot create the remote image cache: {error}"))?;
    Ok(directory)
}

fn clear_cache(directory: &Path) -> Result<usize, String> {
    if !directory.is_dir() {
        return Ok(0);
    }
    let mut removed = 0;
    for entry in fs::read_dir(directory)
        .map_err(|error| format!("Cannot read the remote image cache: {error}"))?
    {
        let entry = entry.map_err(|error| format!("Cannot read cache entry: {error}"))?;
        if entry.path().is_file() {
            fs::remove_file(entry.path())
                .map_err(|error| format!("Cannot remove cached image: {error}"))?;
            removed += 1;
        }
    }
    Ok(removed)
}

#[tauri::command]
pub async fn remote_image_data_url(app: tauri::AppHandle, url: String) -> Result<String, String> {
    let directory = remote_cache_directory(&app)?;
    tauri::async_runtime::spawn_blocking(move || load_or_fetch(&directory, &url))
        .await
        .map_err(|error| format!("Remote image task failed: {error}"))?
}

#[tauri::command]
pub async fn clear_remote_image_cache(app: tauri::AppHandle) -> Result<usize, String> {
    let directory = remote_cache_directory(&app)?;
    tauri::async_runtime::spawn_blocking(move || clear_cache(&directory))
        .await
        .map_err(|error| format!("Remote cache task failed: {error}"))?
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{Read as _, Write as _};
    use std::net::TcpListener;

    #[test]
    fn validates_remote_urls_and_private_addresses() {
        assert!(validate_remote_url("https://example.com/image.png", false).is_ok());
        assert!(validate_remote_url("http://example.com/image.png", false).is_ok());
        assert!(validate_remote_url("file:///etc/passwd", false).is_err());
        assert!(validate_remote_url("https://user:pass@example.com/a.png", false).is_err());
        assert!(validate_remote_url("http://localhost/a.png", false).is_err());
        assert!(validate_remote_url("http://127.0.0.1/a.png", false).is_err());
        assert!(validate_remote_url("http://10.0.0.1/a.png", false).is_err());
        assert!(validate_remote_url("http://192.168.1.1/a.png", false).is_err());
        assert!(validate_remote_url("http://169.254.1.1/a.png", false).is_err());
        assert!(validate_remote_url("http://[::1]/a.png", false).is_err());
        assert!(validate_remote_url("http://[::ffff:127.0.0.1]/a.png", false).is_err());
        assert!(validate_remote_url("http://127.0.0.1/a.png", true).is_ok());
    }

    #[test]
    fn sniffs_supported_image_types() {
        assert_eq!(
            image_mime("", &[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
            Some("image/png")
        );
        assert_eq!(image_mime("image/jpeg", b"anything"), Some("image/jpeg"));
        assert_eq!(image_mime("text/html", b"<html>"), None);
        assert_eq!(
            image_mime("", b"<svg xmlns=\"http://www.w3.org/2000/svg\" />"),
            Some("image/svg+xml")
        );
    }

    #[test]
    fn caches_and_clears_images() {
        let directory = tempfile::tempdir().expect("tempdir");
        let bytes = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
        let url = "https://example.com/pixel.png";
        write_atomic(&cache_file(directory.path(), url), &bytes).expect("cache write");
        let cached = read_cache(directory.path(), url).expect("cache read");
        assert!(cached.starts_with("data:image/png;base64,"));
        assert_eq!(clear_cache(directory.path()).expect("clear"), 1);
        assert!(read_cache(directory.path(), url).is_none());
    }

    #[test]
    fn fetches_a_local_test_image() {
        let listener = TcpListener::bind("127.0.0.1:0").expect("listener");
        let address = listener.local_addr().expect("address");
        let server = std::thread::spawn(move || {
            let (mut stream, _) = listener.accept().expect("accept");
            let mut request = [0_u8; 512];
            let _ = stream.read(&mut request);
            let body = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
            let response = format!(
                "HTTP/1.1 200 OK\r\nContent-Type: image/png\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
                body.len()
            );
            stream.write_all(response.as_bytes()).expect("headers");
            stream.write_all(&body).expect("body");
        });
        let url = format!("http://{address}/pixel.png");
        let (bytes, mime) = fetch_remote_image_with_policy(&url, true).expect("fetch");
        server.join().expect("server");
        assert_eq!(mime, "image/png");
        assert_eq!(bytes, [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    }
}
