mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            commands::document::read_document,
            commands::document::write_document,
            commands::document::write_export,
            commands::document::list_directory,
            commands::document::app_version,
            commands::workspace::list_workspace_files,
            commands::workspace::search_workspace,
            commands::workspace::file_modified_ms,
        ])
        .run(tauri::generate_context!())
        .expect("error while running MarkSI");
}
