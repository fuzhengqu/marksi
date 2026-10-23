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
            commands::image::import_image_asset,
            commands::image::save_image_data,
            commands::image::read_image_data_url,
        ])
        .run(tauri::generate_context!())
        .expect("error while running MarkSI");
}
