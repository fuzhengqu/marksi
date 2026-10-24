use std::fs;
use std::path::{Path, PathBuf};

use serde::Serialize;
use tauri::{AppHandle, Manager};

const MAX_THEME_BYTES: u64 = 256 * 1024;
const MAX_THEMES: usize = 50;
const MAX_NAME_CHARS: usize = 128;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomTheme {
    name: String,
    css: String,
}

#[tauri::command]
pub fn list_custom_themes(app: AppHandle) -> Result<Vec<CustomTheme>, String> {
    let folder = themes_folder(&app)?;
    Ok(list_themes_in(&folder))
}

#[tauri::command]
pub fn custom_themes_folder(app: AppHandle) -> Result<String, String> {
    let folder = themes_folder(&app)?;
    Ok(folder.to_string_lossy().into_owned())
}

fn themes_folder(app: &AppHandle) -> Result<PathBuf, String> {
    let folder = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Cannot locate the app data folder: {error}"))?
        .join("themes");
    fs::create_dir_all(&folder)
        .map_err(|error| format!("Cannot create the themes folder: {error}"))?;
    Ok(folder)
}

fn list_themes_in(folder: &Path) -> Vec<CustomTheme> {
    let Ok(entries) = fs::read_dir(folder) else {
        return Vec::new();
    };
    let Ok(root) = dunce::canonicalize(folder) else {
        return Vec::new();
    };

    let mut themes = Vec::new();
    for entry in entries.flatten() {
        if themes.len() >= MAX_THEMES {
            break;
        }
        let path = entry.path();
        if path
            .extension()
            .and_then(|value| value.to_str())
            .map(|value| !value.eq_ignore_ascii_case("css"))
            .unwrap_or(true)
        {
            continue;
        }
        let Ok(metadata) = entry.metadata() else {
            continue;
        };
        if !metadata.is_file() || metadata.len() == 0 || metadata.len() > MAX_THEME_BYTES {
            continue;
        }
        let Ok(canonical) = dunce::canonicalize(&path) else {
            continue;
        };
        if canonical.strip_prefix(&root).is_err() {
            continue;
        }
        let Some(name) = path.file_name().and_then(|value| value.to_str()) else {
            continue;
        };
        if name.chars().count() > MAX_NAME_CHARS
            || name.chars().any(|character| character.is_control())
        {
            continue;
        }
        let Ok(bytes) = fs::read(&canonical) else {
            continue;
        };
        let Ok(css) = String::from_utf8(bytes) else {
            continue;
        };
        themes.push(CustomTheme {
            name: name.to_string(),
            css,
        });
    }
    themes.sort_by(|left, right| {
        left.name
            .to_lowercase()
            .cmp(&right.name.to_lowercase())
            .then_with(|| left.name.cmp(&right.name))
    });
    themes
}

#[cfg(test)]
mod tests {
    use super::*;

    fn write_theme(folder: &Path, name: &str, css: &str) {
        fs::write(folder.join(name), css).expect("write theme");
    }

    #[test]
    fn lists_sorted_css_files_and_skips_other_files() {
        let folder = tempfile::tempdir().expect("tempdir");
        write_theme(folder.path(), "zebra.css", "body { color: red; }");
        write_theme(folder.path(), "Ocean.CSS", "body { color: blue; }");
        write_theme(folder.path(), "notes.txt", "not css");
        fs::create_dir(folder.path().join("nested.css")).expect("folder");

        let themes = list_themes_in(folder.path());
        assert_eq!(
            themes
                .iter()
                .map(|theme| theme.name.as_str())
                .collect::<Vec<_>>(),
            vec!["Ocean.CSS", "zebra.css"]
        );
        assert_eq!(themes[0].css, "body { color: blue; }");
    }

    #[test]
    fn skips_empty_oversized_invalid_and_unsafe_entries() {
        let folder = tempfile::tempdir().expect("tempdir");
        write_theme(folder.path(), "empty.css", "");
        write_theme(
            folder.path(),
            "huge.css",
            &"a".repeat(MAX_THEME_BYTES as usize + 1),
        );
        fs::write(folder.path().join("invalid.css"), [0xff, 0xfe, 0x00]).expect("invalid utf8");
        write_theme(
            folder.path(),
            &format!("{}.css", "a".repeat(MAX_NAME_CHARS + 1)),
            "body {}",
        );

        let themes = list_themes_in(folder.path());
        assert!(themes.is_empty(), "unexpected themes: {themes:?}");
    }

    #[test]
    fn caps_the_number_of_themes() {
        let folder = tempfile::tempdir().expect("tempdir");
        for index in 0..(MAX_THEMES + 5) {
            write_theme(
                folder.path(),
                &format!("theme-{index:03}.css"),
                "body { color: black; }",
            );
        }
        assert_eq!(list_themes_in(folder.path()).len(), MAX_THEMES);
    }
}
