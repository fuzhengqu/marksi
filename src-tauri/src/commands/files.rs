use std::fs;
use std::io;
use std::path::{Component, Path, PathBuf};
use std::time::UNIX_EPOCH;

use serde::Serialize;

use super::workspace::is_text_file;

const MAX_NAME_CHARS: usize = 200;
const MAX_COPY_ATTEMPTS: usize = 999;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileOperationResult {
    path: String,
    name: String,
    size: u64,
    modified_ms: Option<u64>,
}

#[tauri::command]
pub fn rename_workspace_file(
    root: String,
    path: String,
    new_name: String,
) -> Result<FileOperationResult, String> {
    let root = canonical_root(&root)?;
    let source = workspace_file(&root, &path)?;
    let name = validate_file_name(&new_name)?;
    let target = source
        .parent()
        .ok_or_else(|| format!("{} has no parent folder", source.display()))?
        .join(&name);

    if target == source {
        return describe(&source);
    }
    if target.exists() {
        // Windows allows a rename that only changes letter case.
        let case_only = source
            .file_name()
            .map(|current| current.to_string_lossy().eq_ignore_ascii_case(&name))
            .unwrap_or(false);
        if !case_only {
            return Err(format!("{} already exists.", target.display()));
        }
    }

    fs::rename(&source, &target)
        .map_err(|error| format!("Cannot rename {}: {error}", source.display()))?;
    describe(&target)
}

#[tauri::command]
pub fn duplicate_workspace_file(root: String, path: String) -> Result<FileOperationResult, String> {
    let root = canonical_root(&root)?;
    let source = workspace_file(&root, &path)?;
    let parent = source
        .parent()
        .ok_or_else(|| format!("{} has no parent folder", source.display()))?;
    let target = copy_target(parent, &source)?;

    copy_new_file(&source, &target)?;
    describe(&target)
}

#[tauri::command]
pub fn move_workspace_file(
    root: String,
    path: String,
    target_folder: String,
) -> Result<FileOperationResult, String> {
    let root = canonical_root(&root)?;
    let source = workspace_file(&root, &path)?;
    let folder = destination_folder(&root, &target_folder)?;
    let target = folder.join(
        source
            .file_name()
            .ok_or_else(|| format!("{} has no file name", source.display()))?,
    );

    if target == source {
        return describe(&source);
    }
    if target.exists() {
        return Err(format!("{} already exists.", target.display()));
    }

    fs::rename(&source, &target)
        .map_err(|error| format!("Cannot move {}: {error}", source.display()))?;
    describe(&target)
}

#[tauri::command]
pub fn delete_workspace_file(root: String, path: String) -> Result<(), String> {
    let root = canonical_root(&root)?;
    let target = workspace_file(&root, &path)?;
    fs::remove_file(&target).map_err(|error| format!("Cannot delete {}: {error}", target.display()))
}

fn canonical_root(path: &str) -> Result<PathBuf, String> {
    let root = dunce::canonicalize(Path::new(path))
        .map_err(|error| format!("Cannot open folder {path}: {error}"))?;
    if !root.is_dir() {
        return Err(format!("{} is not a folder", root.display()));
    }
    Ok(root)
}

fn workspace_file(root: &Path, path: &str) -> Result<PathBuf, String> {
    let requested = Path::new(path);
    if !requested.is_absolute() {
        return Err("File operations require an absolute path.".to_string());
    }
    let target = dunce::canonicalize(requested)
        .map_err(|error| format!("Cannot open {}: {error}", requested.display()))?;
    if target.strip_prefix(root).is_err() {
        return Err("File operations are limited to the open workspace.".to_string());
    }
    if !target.is_file() {
        return Err(format!("{} is not a file", target.display()));
    }
    if !is_text_file(&target) {
        return Err("Only supported Markdown and text files can be changed.".to_string());
    }
    Ok(target)
}

fn validate_file_name(input: &str) -> Result<String, String> {
    let name = input.trim();
    if name.is_empty() {
        return Err("Enter a file name.".to_string());
    }
    if name.chars().count() > MAX_NAME_CHARS {
        return Err(format!(
            "File names cannot exceed {MAX_NAME_CHARS} characters."
        ));
    }
    if name == "." || name == ".." {
        return Err("Enter a file name.".to_string());
    }
    if name.contains('/') || name.contains('\\') {
        return Err("File names cannot contain / or \\.".to_string());
    }
    if name
        .chars()
        .any(|character| character.is_control() || r#"<>:"|?*"#.contains(character))
    {
        return Err("File names cannot contain control characters or < > : \" | ? *.".to_string());
    }
    if name.ends_with('.') || name.ends_with(' ') {
        return Err("File names cannot end with a dot or a space.".to_string());
    }
    if !is_text_file(Path::new(name)) {
        return Err("Use a supported Markdown or text file extension.".to_string());
    }
    if is_reserved_device_name(name) {
        return Err("That file name is reserved by the operating system.".to_string());
    }
    Ok(name.to_string())
}

fn is_reserved_device_name(name: &str) -> bool {
    let stem = Path::new(name)
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or(name)
        .trim_end_matches(|character| character == '.' || character == ' ')
        .to_ascii_uppercase();
    matches!(stem.as_str(), "CON" | "PRN" | "AUX" | "NUL")
        || (stem.len() == 4
            && (stem.starts_with("COM") || stem.starts_with("LPT"))
            && stem.as_bytes()[3].is_ascii_digit())
}

fn copy_target(parent: &Path, source: &Path) -> Result<PathBuf, String> {
    let stem = source
        .file_stem()
        .map(|value| value.to_string_lossy().into_owned())
        .unwrap_or_else(|| "document".to_string());
    let extension = source
        .extension()
        .map(|value| format!(".{}", value.to_string_lossy()))
        .unwrap_or_default();

    for index in 1..=MAX_COPY_ATTEMPTS {
        let suffix = if index == 1 {
            " copy".to_string()
        } else {
            format!(" copy {index}")
        };
        let candidate = parent.join(format!("{stem}{suffix}{extension}"));
        if !candidate.exists() {
            return Ok(candidate);
        }
    }
    Err("Cannot find an unused copy name.".to_string())
}

fn copy_new_file(source: &Path, target: &Path) -> Result<(), String> {
    let mut input = fs::File::open(source)
        .map_err(|error| format!("Cannot read {}: {error}", source.display()))?;
    let mut output = fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(target)
        .map_err(|error| format!("Cannot create {}: {error}", target.display()))?;

    let result = io::copy(&mut input, &mut output)
        .and_then(|_| output.sync_all())
        .map_err(|error| format!("Cannot copy onto {}: {error}", target.display()));
    drop(output);
    if result.is_err() {
        let _ = fs::remove_file(target);
    }
    result
}

fn destination_folder(root: &Path, input: &str) -> Result<PathBuf, String> {
    let normalized = input.trim().replace('\\', "/");
    let normalized = normalized.trim_matches('/');
    if normalized.is_empty() {
        return Ok(root.to_path_buf());
    }

    let relative = Path::new(normalized);
    if relative.is_absolute() {
        return Err("Choose a folder inside the workspace.".to_string());
    }
    for component in relative.components() {
        if !matches!(component, Component::Normal(_)) {
            return Err("Choose a folder inside the workspace.".to_string());
        }
    }

    let folder = dunce::canonicalize(root.join(relative))
        .map_err(|error| format!("Cannot open the destination folder: {error}"))?;
    if folder.strip_prefix(root).is_err() {
        return Err("Choose a folder inside the workspace.".to_string());
    }
    if !folder.is_dir() {
        return Err("The destination is not a folder.".to_string());
    }
    Ok(folder)
}

fn describe(path: &Path) -> Result<FileOperationResult, String> {
    let metadata = fs::metadata(path)
        .map_err(|error| format!("Cannot inspect {}: {error}", path.display()))?;
    Ok(FileOperationResult {
        path: path.to_string_lossy().into_owned(),
        name: path
            .file_name()
            .map(|value| value.to_string_lossy().into_owned())
            .unwrap_or_default(),
        size: metadata.len(),
        modified_ms: metadata
            .modified()
            .ok()
            .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
            .map(|duration| duration.as_millis() as u64),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn write_file(root: &Path, relative: &str, content: &str) -> PathBuf {
        let path = root.join(relative);
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).expect("create parent");
        }
        fs::write(&path, content).expect("write fixture");
        path
    }

    fn root_string(root: &Path) -> String {
        root.to_string_lossy().into_owned()
    }

    #[test]
    fn renames_a_file_and_preserves_content() {
        let directory = tempfile::tempdir().expect("tempdir");
        let source = write_file(directory.path(), "note.md", "# Note\n");

        let result = rename_workspace_file(
            root_string(directory.path()),
            source.to_string_lossy().into_owned(),
            "renamed.md".to_string(),
        )
        .expect("rename");

        assert_eq!(result.name, "renamed.md");
        assert!(!source.exists());
        assert_eq!(
            fs::read_to_string(directory.path().join("renamed.md")).expect("read"),
            "# Note\n"
        );
    }

    #[test]
    fn rejects_invalid_names_collisions_and_outside_files() {
        let directory = tempfile::tempdir().expect("tempdir");
        let outside = tempfile::tempdir().expect("outside");
        let source = write_file(directory.path(), "note.md", "body");
        let other = write_file(directory.path(), "other.md", "other");
        let outside_file = write_file(outside.path(), "outside.md", "outside");
        let root = root_string(directory.path());
        let source_path = source.to_string_lossy().into_owned();

        for invalid in [
            "",
            "..",
            "../escape.md",
            "nested/name.md",
            "image.png",
            "bad:name.md",
        ] {
            let error =
                rename_workspace_file(root.clone(), source_path.clone(), invalid.to_string())
                    .expect_err("invalid name should fail");
            assert!(!error.is_empty());
        }

        let collision = rename_workspace_file(
            root.clone(),
            source_path.clone(),
            other
                .file_name()
                .expect("file name")
                .to_string_lossy()
                .into_owned(),
        )
        .expect_err("collision should fail");
        assert!(collision.contains("already exists"));

        let outside_error =
            delete_workspace_file(root.clone(), outside_file.to_string_lossy().into_owned())
                .expect_err("outside file should fail");
        assert!(outside_error.contains("open workspace"));
        assert!(outside_file.exists());
    }

    #[test]
    fn duplicates_with_numbered_names_and_matching_bytes() {
        let directory = tempfile::tempdir().expect("tempdir");
        let source = write_file(directory.path(), "note.md", "same bytes");
        let root = root_string(directory.path());
        let source_path = source.to_string_lossy().into_owned();

        let first =
            duplicate_workspace_file(root.clone(), source_path.clone()).expect("first copy");
        let second = duplicate_workspace_file(root, source_path).expect("second copy");

        assert_eq!(first.name, "note copy.md");
        assert_eq!(second.name, "note copy 2.md");
        assert_eq!(
            fs::read_to_string(directory.path().join("note copy.md")).expect("read copy"),
            "same bytes"
        );
        assert_eq!(
            fs::read_to_string(directory.path().join("note copy 2.md")).expect("read copy"),
            "same bytes"
        );
    }

    #[test]
    fn moves_a_file_into_a_workspace_folder() {
        let directory = tempfile::tempdir().expect("tempdir");
        fs::create_dir(directory.path().join("notes")).expect("folder");
        let source = write_file(directory.path(), "note.md", "body");
        let root = root_string(directory.path());

        let result = move_workspace_file(
            root.clone(),
            source.to_string_lossy().into_owned(),
            "notes".to_string(),
        )
        .expect("move");

        assert_eq!(result.name, "note.md");
        assert!(directory.path().join("notes/note.md").is_file());
        assert!(!source.exists());

        let traversal = move_workspace_file(
            root,
            directory
                .path()
                .join("notes/note.md")
                .to_string_lossy()
                .into_owned(),
            "../".to_string(),
        )
        .expect_err("traversal should fail");
        assert!(traversal.contains("inside the workspace"));
    }

    #[test]
    fn deletes_only_workspace_text_files() {
        let directory = tempfile::tempdir().expect("tempdir");
        let source = write_file(directory.path(), "note.md", "body");
        let folder = directory.path().join("notes");
        fs::create_dir(&folder).expect("folder");
        let root = root_string(directory.path());

        let error = delete_workspace_file(root.clone(), folder.to_string_lossy().into_owned())
            .expect_err("directory should fail");
        assert!(error.contains("not a file"));

        delete_workspace_file(root, source.to_string_lossy().into_owned()).expect("delete");
        assert!(!source.exists());
    }
}
