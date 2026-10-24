use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Manager};

use super::document::write_atomic;

const MAX_SNAPSHOT_BYTES: usize = 4 * 1024 * 1024;
const MAX_SNAPSHOTS: usize = 40;
const PREVIEW_CHARS: usize = 240;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct StoredSnapshot {
    id: String,
    document_path: String,
    name: String,
    saved_at: u64,
    size: u64,
    encoding: String,
    line_ending: String,
    content: String,
    content_hash: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryEntry {
    id: String,
    name: String,
    saved_at: u64,
    size: u64,
    encoding: String,
    line_ending: String,
    preview: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryContent {
    id: String,
    saved_at: u64,
    encoding: String,
    line_ending: String,
    content: String,
}

#[tauri::command]
pub fn record_history(
    app: AppHandle,
    path: String,
    name: String,
    content: String,
    encoding: String,
    line_ending: String,
) -> Result<Option<HistoryEntry>, String> {
    let root = history_root(&app)?;
    record_at(&root, &path, &name, &content, &encoding, &line_ending)
}

#[tauri::command]
pub fn list_history(app: AppHandle, path: String) -> Result<Vec<HistoryEntry>, String> {
    let root = history_root(&app)?;
    list_at(&root, &path)
}

#[tauri::command]
pub fn read_history(app: AppHandle, path: String, id: String) -> Result<HistoryContent, String> {
    let root = history_root(&app)?;
    read_at(&root, &path, &id)
}

#[tauri::command]
pub fn delete_history(app: AppHandle, path: String, id: String) -> Result<(), String> {
    let root = history_root(&app)?;
    delete_at(&root, &path, &id)
}

#[tauri::command]
pub fn clear_history(app: AppHandle, path: String) -> Result<usize, String> {
    let root = history_root(&app)?;
    clear_at(&root, &path)
}

#[tauri::command]
pub fn relocate_history(
    app: AppHandle,
    old_path: String,
    new_path: String,
) -> Result<usize, String> {
    let root = history_root(&app)?;
    relocate_at(&root, &old_path, &new_path)
}

fn history_root(app: &AppHandle) -> Result<PathBuf, String> {
    let root = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Cannot locate the app data folder: {error}"))?
        .join("history");
    fs::create_dir_all(&root)
        .map_err(|error| format!("Cannot create the history folder: {error}"))?;
    Ok(root)
}

fn record_at(
    root: &Path,
    path: &str,
    name: &str,
    content: &str,
    encoding: &str,
    line_ending: &str,
) -> Result<Option<HistoryEntry>, String> {
    if content.is_empty() || content.len() > MAX_SNAPSHOT_BYTES {
        return Ok(None);
    }

    let document_path = normalize_document_path(path);
    let folder = document_folder(root, &document_path);
    fs::create_dir_all(&folder)
        .map_err(|error| format!("Cannot create the history folder: {error}"))?;

    let mut snapshots = read_snapshots(&folder)?;
    snapshots.sort_by_key(|snapshot| snapshot.saved_at);
    let content_hash = hash_text(content);
    if snapshots
        .last()
        .is_some_and(|snapshot| snapshot.content_hash == content_hash)
    {
        return Ok(None);
    }

    let latest = snapshots
        .last()
        .map(|snapshot| snapshot.saved_at)
        .unwrap_or(0);
    let saved_at = now_ms().max(latest.saturating_add(1));
    let mut id = saved_at.to_string();
    let mut attempt = 1;
    while folder.join(format!("{id}.json")).exists() {
        id = format!("{saved_at}-{attempt}");
        attempt += 1;
        if attempt > 999 {
            return Err("Cannot allocate a history snapshot name.".to_string());
        }
    }

    let preview = preview_text(content);
    let snapshot = StoredSnapshot {
        id: id.clone(),
        document_path,
        name: name.to_string(),
        saved_at,
        size: content.len() as u64,
        encoding: encoding.to_string(),
        line_ending: line_ending.to_string(),
        content: content.to_string(),
        content_hash,
    };
    let json = serde_json::to_vec(&snapshot)
        .map_err(|error| format!("Cannot encode a history snapshot: {error}"))?;
    write_atomic(&folder.join(format!("{id}.json")), &json)?;

    snapshots.push(snapshot);
    snapshots.sort_by_key(|snapshot| snapshot.saved_at);
    while snapshots.len() > MAX_SNAPSHOTS {
        let oldest = snapshots.remove(0);
        let _ = fs::remove_file(folder.join(format!("{}.json", oldest.id)));
    }

    Ok(Some(HistoryEntry {
        id,
        name: name.to_string(),
        saved_at,
        size: content.len() as u64,
        encoding: encoding.to_string(),
        line_ending: line_ending.to_string(),
        preview,
    }))
}

fn list_at(root: &Path, path: &str) -> Result<Vec<HistoryEntry>, String> {
    let document_path = normalize_document_path(path);
    let folder = document_folder(root, &document_path);
    if !folder.is_dir() {
        return Ok(Vec::new());
    }
    let mut snapshots = read_snapshots(&folder)?;
    snapshots.sort_by(|left, right| right.saved_at.cmp(&left.saved_at));
    Ok(snapshots
        .into_iter()
        .map(|snapshot| HistoryEntry {
            id: snapshot.id,
            name: snapshot.name,
            saved_at: snapshot.saved_at,
            size: snapshot.size,
            encoding: snapshot.encoding,
            line_ending: snapshot.line_ending,
            preview: preview_text(&snapshot.content),
        })
        .collect())
}

fn read_at(root: &Path, path: &str, id: &str) -> Result<HistoryContent, String> {
    let (snapshot, _) = load_snapshot(root, path, id)?;
    Ok(HistoryContent {
        id: snapshot.id,
        saved_at: snapshot.saved_at,
        encoding: snapshot.encoding,
        line_ending: snapshot.line_ending,
        content: snapshot.content,
    })
}

fn delete_at(root: &Path, path: &str, id: &str) -> Result<(), String> {
    let (_, file) = load_snapshot(root, path, id)?;
    fs::remove_file(&file).map_err(|error| format!("Cannot delete the history snapshot: {error}"))
}

fn clear_at(root: &Path, path: &str) -> Result<usize, String> {
    let document_path = normalize_document_path(path);
    let folder = document_folder(root, &document_path);
    if !folder.is_dir() {
        return Ok(0);
    }
    let count = read_snapshots(&folder)?.len();
    fs::remove_dir_all(&folder).map_err(|error| format!("Cannot clear local history: {error}"))?;
    Ok(count)
}

fn relocate_at(root: &Path, old_path: &str, new_path: &str) -> Result<usize, String> {
    let old_document = normalize_document_path(old_path);
    let new_document = normalize_document_path(new_path);
    if old_document == new_document {
        return Ok(0);
    }
    let old_folder = document_folder(root, &old_document);
    if !old_folder.is_dir() {
        return Ok(0);
    }
    let new_folder = document_folder(root, &new_document);
    fs::create_dir_all(&new_folder)
        .map_err(|error| format!("Cannot create the history folder: {error}"))?;

    let mut moved = 0;
    let mut snapshots = read_snapshots(&old_folder)?;
    snapshots.sort_by_key(|snapshot| snapshot.saved_at);
    let mut new_snapshots = read_snapshots(&new_folder)?;
    new_snapshots.sort_by_key(|snapshot| snapshot.saved_at);

    for mut snapshot in snapshots {
        let old_id = snapshot.id.clone();
        let mut saved_at = snapshot.saved_at;
        let mut id = snapshot.id.clone();
        if new_folder.join(format!("{id}.json")).exists() {
            let latest = new_snapshots
                .last()
                .map(|entry| entry.saved_at)
                .unwrap_or(0);
            saved_at = now_ms().max(latest.saturating_add(1));
            id = saved_at.to_string();
        }
        snapshot.document_path = new_document.clone();
        snapshot.saved_at = saved_at;
        snapshot.id = id.clone();
        let json = serde_json::to_vec(&snapshot)
            .map_err(|error| format!("Cannot encode a history snapshot: {error}"))?;
        write_atomic(&new_folder.join(format!("{id}.json")), &json)?;
        let _ = fs::remove_file(old_folder.join(format!("{old_id}.json")));
        new_snapshots.push(snapshot);
        moved += 1;
    }

    new_snapshots.sort_by_key(|snapshot| snapshot.saved_at);
    while new_snapshots.len() > MAX_SNAPSHOTS {
        let oldest = new_snapshots.remove(0);
        let _ = fs::remove_file(new_folder.join(format!("{}.json", oldest.id)));
    }
    let _ = fs::remove_dir(&old_folder);
    Ok(moved)
}

fn load_snapshot(root: &Path, path: &str, id: &str) -> Result<(StoredSnapshot, PathBuf), String> {
    if !valid_id(id) {
        return Err("Invalid history snapshot id.".to_string());
    }
    let document_path = normalize_document_path(path);
    let folder = document_folder(root, &document_path);
    let file = folder.join(format!("{id}.json"));
    let bytes =
        fs::read(&file).map_err(|error| format!("Cannot read the history snapshot: {error}"))?;
    let snapshot: StoredSnapshot = serde_json::from_slice(&bytes)
        .map_err(|error| format!("Cannot decode the history snapshot: {error}"))?;
    if normalize_document_path(&snapshot.document_path) != document_path {
        return Err("The history snapshot belongs to another document.".to_string());
    }
    Ok((snapshot, file))
}

fn read_snapshots(folder: &Path) -> Result<Vec<StoredSnapshot>, String> {
    let mut snapshots = Vec::new();
    let entries = match fs::read_dir(folder) {
        Ok(entries) => entries,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(snapshots),
        Err(error) => return Err(format!("Cannot read local history: {error}")),
    };
    for entry in entries {
        let Ok(entry) = entry else {
            continue;
        };
        let path = entry.path();
        if path.extension().and_then(|value| value.to_str()) != Some("json") {
            continue;
        }
        let Ok(bytes) = fs::read(&path) else {
            continue;
        };
        if let Ok(snapshot) = serde_json::from_slice::<StoredSnapshot>(&bytes) {
            snapshots.push(snapshot);
        }
    }
    Ok(snapshots)
}

fn document_folder(root: &Path, document_path: &str) -> PathBuf {
    let mut hasher = Sha256::new();
    hasher.update(document_path.as_bytes());
    let digest = hasher.finalize();
    let key = digest
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect::<String>();
    root.join(key)
}

fn normalize_document_path(path: &str) -> String {
    let canonical = dunce::canonicalize(path).unwrap_or_else(|_| PathBuf::from(path));
    let normalized = canonical.to_string_lossy().replace('\\', "/");
    #[cfg(windows)]
    let normalized = normalized.to_lowercase();
    normalized
}

fn hash_text(content: &str) -> String {
    let digest = Sha256::digest(content.as_bytes());
    digest.iter().map(|byte| format!("{byte:02x}")).collect()
}

fn valid_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 40
        && id
            .chars()
            .all(|character| character.is_ascii_digit() || character == '-')
}

fn preview_text(content: &str) -> String {
    let mut preview = String::new();
    let mut last_was_space = false;
    for character in content.chars() {
        if preview.chars().count() >= PREVIEW_CHARS {
            break;
        }
        if character.is_whitespace() {
            if !last_was_space && !preview.is_empty() {
                preview.push(' ');
                last_was_space = true;
            }
            continue;
        }
        preview.push(character);
        last_was_space = false;
    }
    preview.trim_end().to_string()
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn write_snapshot(root: &Path, path: &str, content: &str) -> Option<HistoryEntry> {
        record_at(root, path, "note.md", content, "UTF-8", "LF").expect("record")
    }

    #[test]
    fn records_lists_reads_and_clears_snapshots() {
        let root = tempfile::tempdir().expect("tempdir");
        assert!(write_snapshot(root.path(), "/notes/note.md", "first").is_some());
        assert!(write_snapshot(root.path(), "/notes/note.md", "second").is_some());

        let entries = list_at(root.path(), "/notes/note.md").expect("list");
        assert_eq!(entries.len(), 2);
        assert_eq!(entries[0].preview, "second");
        assert_eq!(entries[1].preview, "first");

        let content = read_at(root.path(), "/notes/note.md", &entries[1].id).expect("read");
        assert_eq!(content.content, "first");

        delete_at(root.path(), "/notes/note.md", &entries[0].id).expect("delete");
        assert_eq!(
            list_at(root.path(), "/notes/note.md").expect("list").len(),
            1
        );

        assert_eq!(clear_at(root.path(), "/notes/note.md").expect("clear"), 1);
        assert!(list_at(root.path(), "/notes/note.md")
            .expect("list after clear")
            .is_empty());
    }

    #[test]
    fn skips_empty_oversized_and_duplicate_snapshots() {
        let root = tempfile::tempdir().expect("tempdir");
        assert!(write_snapshot(root.path(), "/note.md", "").is_none());
        let oversized = "a".repeat(MAX_SNAPSHOT_BYTES + 1);
        assert!(write_snapshot(root.path(), "/note.md", &oversized).is_none());
        assert!(write_snapshot(root.path(), "/note.md", "same").is_some());
        assert!(write_snapshot(root.path(), "/note.md", "same").is_none());
        assert_eq!(list_at(root.path(), "/note.md").expect("list").len(), 1);
    }

    #[test]
    fn rejects_invalid_ids_and_other_documents() {
        let root = tempfile::tempdir().expect("tempdir");
        let entry = write_snapshot(root.path(), "/a/note.md", "body").expect("record");

        assert!(read_at(root.path(), "/a/note.md", "../escape").is_err());
        assert!(read_at(root.path(), "/b/note.md", &entry.id).is_err());
        assert!(delete_at(root.path(), "/a/note.md", "../escape").is_err());
    }

    #[test]
    fn relocates_history_when_a_document_is_renamed_or_moved() {
        let root = tempfile::tempdir().expect("tempdir");
        write_snapshot(root.path(), "/old/note.md", "first").expect("record");
        write_snapshot(root.path(), "/old/note.md", "second").expect("record");

        assert_eq!(
            relocate_at(root.path(), "/old/note.md", "/new/renamed.md").expect("relocate"),
            2
        );
        assert!(list_at(root.path(), "/old/note.md")
            .expect("old list")
            .is_empty());
        let entries = list_at(root.path(), "/new/renamed.md").expect("new list");
        assert_eq!(entries.len(), 2);
        assert_eq!(entries[0].preview, "second");
        let content = read_at(root.path(), "/new/renamed.md", &entries[1].id).expect("read");
        assert_eq!(content.content, "first");
    }

    #[test]
    fn merges_relocated_history_with_an_existing_target() {
        let root = tempfile::tempdir().expect("tempdir");
        write_snapshot(root.path(), "/old/note.md", "old version").expect("record");
        write_snapshot(root.path(), "/new/note.md", "new version").expect("record");

        assert_eq!(
            relocate_at(root.path(), "/old/note.md", "/new/note.md").expect("relocate"),
            1
        );
        let entries = list_at(root.path(), "/new/note.md").expect("list");
        assert_eq!(entries.len(), 2);
        assert!(entries.iter().any(|entry| entry.preview == "old version"));
        assert!(entries.iter().any(|entry| entry.preview == "new version"));
    }

    #[test]
    fn keeps_only_the_newest_snapshots() {
        let root = tempfile::tempdir().expect("tempdir");
        for index in 0..(MAX_SNAPSHOTS + 3) {
            assert!(write_snapshot(root.path(), "/note.md", &format!("version {index}")).is_some());
        }
        let entries = list_at(root.path(), "/note.md").expect("list");
        assert_eq!(entries.len(), MAX_SNAPSHOTS);
        assert!(entries[0]
            .preview
            .contains(&format!("version {}", MAX_SNAPSHOTS + 2)));
        assert!(!entries
            .iter()
            .any(|entry| entry.preview.contains("version 0")));
    }

    #[test]
    fn hashes_paths_without_using_them_as_folder_names() {
        let root = tempfile::tempdir().expect("tempdir");
        write_snapshot(root.path(), "/notes/note.md", "body").expect("record");
        let folders: Vec<_> = fs::read_dir(root.path())
            .expect("read root")
            .filter_map(Result::ok)
            .collect();
        assert_eq!(folders.len(), 1);
        let name = folders[0].file_name().to_string_lossy().into_owned();
        assert_eq!(name.len(), 64);
        assert!(name.chars().all(|character| character.is_ascii_hexdigit()));
    }
}
