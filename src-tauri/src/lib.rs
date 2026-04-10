mod commands;
mod services;
mod types;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            commands::read_folder,
            commands::read_and_parse_file,
            commands::read_file_raw,
            commands::write_file,
            commands::create_file,
            commands::create_folder,
            commands::delete_item,
            commands::rename_item,
            commands::start_file_watcher,
            commands::check_git_repo,
            commands::get_git_info,
            commands::git_auto_push,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
