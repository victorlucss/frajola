mod commands;
mod db;
mod error;

use std::fs;

use db::Database;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("failed to resolve app data dir");

            fs::create_dir_all(&app_data_dir)
                .expect("failed to create app data directory");

            let db_path = app_data_dir.join("frajola.db");
            let database =
                Database::new(&db_path).expect("failed to initialize database");

            app.manage(database);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::settings::get_settings,
            commands::settings::get_setting,
            commands::settings::set_setting,
            commands::meetings::list_meetings,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
