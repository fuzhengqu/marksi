mod commands;

use std::path::Path;
use std::sync::Mutex;

use tauri::State;

pub struct StartupFile(Mutex<Option<String>>);

fn parse_startup_file(args: impl IntoIterator<Item = String>) -> Option<String> {
    for argument in args {
        if argument.starts_with('-') || argument == "--" {
            continue;
        }
        let path = Path::new(&argument);
        if path.is_file() && commands::workspace::is_text_file(path) {
            return Some(path.to_string_lossy().into_owned());
        }
    }
    None
}

#[tauri::command]
fn take_startup_file(state: State<'_, StartupFile>) -> Option<String> {
    state.0.lock().ok().and_then(|mut value| value.take())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let startup_file = parse_startup_file(std::env::args().skip(1));
    tauri::Builder::default()
        .manage(StartupFile(Mutex::new(startup_file)))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            take_startup_file,
            commands::document::read_document,
            commands::document::read_document_with_encoding,
            commands::document::write_document,
            commands::document::write_export,
            commands::document::write_export_binary,
            commands::document::list_directory,
            commands::document::app_version,
            commands::export::run_export_command,
            commands::pandoc::pandoc_version,
            commands::pandoc::pandoc_export,
            commands::pandoc::pandoc_import,
            commands::remote_image::remote_image_data_url,
            commands::remote_image::clear_remote_image_cache,
            commands::workspace::list_workspace_files,
            commands::workspace::search_workspace,
            commands::workspace::file_modified_ms,
            commands::files::rename_workspace_file,
            commands::files::duplicate_workspace_file,
            commands::files::move_workspace_file,
            commands::files::delete_workspace_file,
            commands::history::record_history,
            commands::history::list_history,
            commands::history::read_history,
            commands::history::delete_history,
            commands::history::clear_history,
            commands::history::relocate_history,
            commands::themes::list_custom_themes,
            commands::themes::custom_themes_folder,
            commands::image::import_image_asset,
            commands::image::save_image_data,
            commands::image::read_image_data_url,
        ])
        .run(tauri::generate_context!())
        .expect("error while running MarkSI");
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn takes_the_first_existing_supported_file_argument() {
        let directory = tempfile::tempdir().expect("tempdir");
        let note = directory.path().join("note.md");
        let image = directory.path().join("image.png");
        fs::write(&note, "# Note\n").expect("note");
        fs::write(&image, "png").expect("image");

        let args = vec![
            "--flag".to_string(),
            "--".to_string(),
            directory.path().to_string_lossy().into_owned(),
            image.to_string_lossy().into_owned(),
            note.to_string_lossy().into_owned(),
        ];
        assert_eq!(
            parse_startup_file(args),
            Some(note.to_string_lossy().into_owned())
        );
    }

    #[test]
    fn ignores_missing_and_unsupported_arguments() {
        let directory = tempfile::tempdir().expect("tempdir");
        let image = directory.path().join("image.png");
        fs::write(&image, "png").expect("image");

        assert_eq!(
            parse_startup_file(vec![image.to_string_lossy().into_owned()]),
            None
        );
        assert_eq!(
            parse_startup_file(vec![directory.path().to_string_lossy().into_owned()]),
            None
        );
        assert_eq!(parse_startup_file(Vec::new()), None);
    }
}
