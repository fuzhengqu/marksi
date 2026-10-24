mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
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
            commands::image::import_image_asset,
            commands::image::save_image_data,
            commands::image::read_image_data_url,
        ])
        .run(tauri::generate_context!())
        .expect("error while running MarkSI");
}
