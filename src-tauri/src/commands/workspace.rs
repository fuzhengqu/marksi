use std::fs;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

use serde::Serialize;
use walkdir::{DirEntry, WalkDir};

use super::document::{decode_bytes, should_skip};

const DEFAULT_FILE_LIMIT: usize = 2_000;
const MAX_FILE_LIMIT: usize = 20_000;
const DEFAULT_MATCH_LIMIT: usize = 200;
const MAX_MATCH_LIMIT: usize = 2_000;
const MAX_SEARCH_FILE_BYTES: u64 = 4 * 1024 * 1024;
const PREVIEW_CHARS: usize = 280;

const TEXT_EXTENSIONS: &[&str] = &[
    "md", "markdown", "mdown", "mkd", "mdwn", "mmd", "mdx", "txt", "text",
];

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceFile {
    name: String,
    path: String,
    relative_path: String,
    size: u64,
    modified_ms: Option<u64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchMatch {
    path: String,
    name: String,
    relative_path: String,
    line: usize,
    column: usize,
    preview: String,
}

#[tauri::command]
pub fn list_workspace_files(
    root: String,
    limit: Option<usize>,
) -> Result<Vec<WorkspaceFile>, String> {
    let root = canonical_directory(&root)?;
    let limit = limit.unwrap_or(DEFAULT_FILE_LIMIT).clamp(1, MAX_FILE_LIMIT);
    let mut files = Vec::new();

    for entry in WalkDir::new(&root)
        .follow_links(false)
        .into_iter()
        .filter_entry(|entry| !is_skipped_dir(entry))
    {
        if files.len() >= limit {
            break;
        }
        let entry = match entry {
            Ok(entry) => entry,
            Err(_) => continue,
        };
        if !entry.file_type().is_file() || !is_text_file(entry.path()) {
            continue;
        }
        let metadata = match entry.metadata() {
            Ok(metadata) => metadata,
            Err(_) => continue,
        };
        files.push(WorkspaceFile {
            name: entry.file_name().to_string_lossy().into_owned(),
            path: entry.path().to_string_lossy().into_owned(),
            relative_path: relative_path(&root, entry.path()),
            size: metadata.len(),
            modified_ms: modified_ms(&metadata),
        });
    }

    files.sort_by(|left, right| {
        left.relative_path
            .to_lowercase()
            .cmp(&right.relative_path.to_lowercase())
    });
    Ok(files)
}

#[tauri::command]
pub fn search_workspace(
    root: String,
    query: String,
    case_sensitive: bool,
    max_results: Option<usize>,
) -> Result<Vec<SearchMatch>, String> {
    if query.is_empty() {
        return Ok(Vec::new());
    }

    let root = canonical_directory(&root)?;
    let limit = max_results
        .unwrap_or(DEFAULT_MATCH_LIMIT)
        .clamp(1, MAX_MATCH_LIMIT);
    let mut matches = Vec::new();

    for entry in WalkDir::new(&root)
        .follow_links(false)
        .into_iter()
        .filter_entry(|entry| !is_skipped_dir(entry))
    {
        if matches.len() >= limit {
            break;
        }
        let entry = match entry {
            Ok(entry) => entry,
            Err(_) => continue,
        };
        if !entry.file_type().is_file() || !is_text_file(entry.path()) {
            continue;
        }
        let metadata = match entry.metadata() {
            Ok(metadata) => metadata,
            Err(_) => continue,
        };
        if metadata.len() > MAX_SEARCH_FILE_BYTES {
            continue;
        }
        let bytes = match fs::read(entry.path()) {
            Ok(bytes) => bytes,
            Err(_) => continue,
        };
        let (content, _, _, _) = decode_bytes(&bytes);
        let relative = relative_path(&root, entry.path());
        let name = entry.file_name().to_string_lossy().into_owned();
        let path = entry.path().to_string_lossy().into_owned();

        for (index, raw_line) in content.lines().enumerate() {
            if matches.len() >= limit {
                break;
            }
            let line = raw_line.strip_suffix('\r').unwrap_or(raw_line);
            let Some(byte_index) = find_in_line(line, &query, case_sensitive) else {
                continue;
            };
            matches.push(SearchMatch {
                path: path.clone(),
                name: name.clone(),
                relative_path: relative.clone(),
                line: index + 1,
                column: line[..byte_index].chars().count() + 1,
                preview: preview_line(line),
            });
        }
    }

    Ok(matches)
}

#[tauri::command]
pub fn file_modified_ms(path: String) -> Result<Option<u64>, String> {
    let requested = PathBuf::from(&path);
    let target = dunce::canonicalize(&requested)
        .map_err(|error| format!("Cannot inspect {}: {error}", requested.display()))?;
    let metadata = fs::metadata(&target)
        .map_err(|error| format!("Cannot inspect {}: {error}", target.display()))?;
    Ok(modified_ms(&metadata))
}

fn canonical_directory(path: &str) -> Result<PathBuf, String> {
    let root = dunce::canonicalize(Path::new(path))
        .map_err(|error| format!("Cannot open folder {path}: {error}"))?;
    if !root.is_dir() {
        return Err(format!("{} is not a folder", root.display()));
    }
    Ok(root)
}

fn is_skipped_dir(entry: &DirEntry) -> bool {
    entry.depth() > 0
        && entry.file_type().is_dir()
        && should_skip(&entry.file_name().to_string_lossy())
}

fn is_text_file(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| {
            TEXT_EXTENSIONS
                .iter()
                .any(|candidate| extension.eq_ignore_ascii_case(candidate))
        })
}

fn relative_path(root: &Path, path: &Path) -> String {
    path.strip_prefix(root)
        .unwrap_or(path)
        .to_string_lossy()
        .replace('\\', "/")
}

fn find_in_line(line: &str, query: &str, case_sensitive: bool) -> Option<usize> {
    if case_sensitive {
        line.find(query)
    } else {
        line.to_lowercase().find(&query.to_lowercase())
    }
}

fn preview_line(line: &str) -> String {
    let trimmed = line.trim();
    let mut preview: String = trimmed.chars().take(PREVIEW_CHARS).collect();
    if trimmed.chars().count() > PREVIEW_CHARS {
        preview.push('…');
    }
    preview
}

fn modified_ms(metadata: &fs::Metadata) -> Option<u64> {
    metadata
        .modified()
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_millis() as u64)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn write_file(root: &Path, relative: &str, content: &str) {
        let path = root.join(relative);
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).expect("create parent");
        }
        fs::write(path, content).expect("write fixture");
    }

    #[test]
    fn lists_supported_files_with_relative_paths() {
        let directory = tempfile::tempdir().expect("tempdir");
        write_file(directory.path(), "b.md", "beta");
        write_file(directory.path(), "docs/a.markdown", "alpha");
        write_file(directory.path(), "image.png", "not text");
        write_file(directory.path(), "node_modules/ignored.md", "nope");

        let files = list_workspace_files(directory.path().to_string_lossy().into_owned(), None)
            .expect("list");

        let relative: Vec<&str> = files
            .iter()
            .map(|file| file.relative_path.as_str())
            .collect();
        assert_eq!(relative, vec!["b.md", "docs/a.markdown"]);
    }

    #[test]
    fn searches_case_sensitively_and_reports_line_and_column() {
        let directory = tempfile::tempdir().expect("tempdir");
        write_file(
            directory.path(),
            "note.md",
            "first line\nA MarkSI mention\nmarkSI again\n",
        );
        let root = directory.path().to_string_lossy().into_owned();

        let sensitive = search_workspace(root.clone(), "MarkSI".to_string(), true, None)
            .expect("case-sensitive search");
        assert_eq!(sensitive.len(), 1);
        assert_eq!(sensitive[0].line, 2);
        assert_eq!(sensitive[0].column, 3);

        let insensitive = search_workspace(root, "marksi".to_string(), false, None)
            .expect("case-insensitive search");
        assert_eq!(insensitive.len(), 2);
        assert_eq!(insensitive[1].line, 3);
    }

    #[test]
    fn searches_are_limited_and_skip_ignored_folders() {
        let directory = tempfile::tempdir().expect("tempdir");
        write_file(directory.path(), "one.md", "needle\nneedle\nneedle");
        write_file(directory.path(), "target/two.md", "needle");
        let root = directory.path().to_string_lossy().into_owned();

        let matches = search_workspace(root, "needle".to_string(), true, Some(2)).expect("search");
        assert_eq!(matches.len(), 2);
        assert!(matches.iter().all(|item| item.relative_path == "one.md"));
    }

    #[test]
    fn reports_file_modification_time() {
        let directory = tempfile::tempdir().expect("tempdir");
        let path = directory.path().join("note.md");
        fs::write(&path, "hello").expect("write");

        let modified = file_modified_ms(path.to_string_lossy().into_owned()).expect("metadata");
        assert!(modified.is_some());
    }
}
