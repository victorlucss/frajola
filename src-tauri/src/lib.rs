mod ai;
mod audio;
mod commands;
mod db;
mod error;
mod transcribe;

use std::fs;
use std::sync::Mutex;

use audio::state::RecordingState;
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

            // Create recordings directory
            fs::create_dir_all(app_data_dir.join("recordings"))
                .expect("failed to create recordings directory");

            let db_path = app_data_dir.join("frajola.db");
            let database =
                Database::new(&db_path).expect("failed to initialize database");

            app.manage(database);
            app.manage(RecordingState {
                active: Mutex::new(None),
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::settings::get_settings,
            commands::settings::get_setting,
            commands::settings::set_setting,
            commands::meetings::list_meetings,
            commands::meetings::get_meeting,
            commands::meetings::delete_meeting,
            commands::recording::start_recording,
            commands::recording::stop_recording,
            commands::recording::pause_recording,
            commands::recording::resume_recording,
            commands::recording::get_recording_status,
            commands::recording::list_audio_devices,
            commands::recording::open_audio_permission_settings,
            commands::meetings::get_meeting_detail,
            commands::transcribe::get_model_status,
            commands::transcribe::download_model,
            commands::transcribe::transcribe_meeting,
            commands::ai::summarize_meeting,
            commands::ai::check_ollama_status,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
