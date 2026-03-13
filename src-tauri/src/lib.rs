mod ai;
mod audio;
mod commands;
pub mod db;
pub mod dictation;
mod error;
mod system;
mod transcribe;

use std::fs;
use std::sync::atomic::Ordering;
use std::sync::Mutex;

use audio::state::RecordingState;
use db::Database;
use dictation::state::DictationState;
use tauri::{Manager, RunEvent};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
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
            app.manage(DictationState::new());

            // Register global hotkey for dictation
            register_dictation_hotkey(app.handle())?;

            // Request permissions on macOS
            #[cfg(target_os = "macos")]
            {
                dictation::apple_speech::request_permissions();
            }

            // On non-macOS: use native decorations and clear vibrancy effects
            #[cfg(not(target_os = "macos"))]
            {
                if let Some(win) = app.get_webview_window("main") {
                    let _ = win.set_decorations(true);
                    let _ = win.set_effects(None);
                }
            }

            // Start meeting detection loop
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(system::meeting_detector::start_detection_loop(handle));

            // Keep overlay visibility synced with minimize state.
            // This is more reliable on macOS than focus-only heuristics.
            let overlay_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                loop {
                    tokio::time::sleep(std::time::Duration::from_millis(300)).await;

                    let Some(main_win) = overlay_handle.get_webview_window("main") else {
                        continue;
                    };
                    let Some(overlay_win) = overlay_handle.get_webview_window("overlay") else {
                        continue;
                    };

                    let is_minimized = main_win.is_minimized().unwrap_or(false);
                    let is_main_visible = main_win.is_visible().unwrap_or(true);
                    let is_overlay_visible = overlay_win.is_visible().unwrap_or(false);
                    let should_show_overlay = is_minimized || !is_main_visible;

                    if should_show_overlay && !is_overlay_visible {
                        let _ = overlay_win.show();
                    } else if !should_show_overlay && is_overlay_visible {
                        let _ = overlay_win.hide();
                    }
                }
            });

            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() == "main" {
                match event {
                    // Graceful shutdown: stop recording when main window is closing
                    tauri::WindowEvent::CloseRequested { api, .. } => {
                        // Keep app alive in overlay-only mode when user closes the main window.
                        api.prevent_close();
                        let _ = window.hide();
                        if let Some(overlay) = window.app_handle().get_webview_window("overlay") {
                            let _ = overlay.show();
                        }
                    }
                    // Exit the entire app when main window is destroyed
                    tauri::WindowEvent::Destroyed => {
                        window.app_handle().exit(0);
                    }
                    // Show overlay when main window is minimized, hide when focused
                    tauri::WindowEvent::Focused(focused) => {
                        let app = window.app_handle().clone();
                        if *focused {
                            // Main window active — hide overlay
                            if let Some(overlay) = app.get_webview_window("overlay") {
                                let _ = overlay.hide();
                            }
                        } else {
                            // Main lost focus — check if minimized after a short delay
                            tauri::async_runtime::spawn(async move {
                                tokio::time::sleep(std::time::Duration::from_millis(300)).await;
                                if let Some(main_win) = app.get_webview_window("main") {
                                    if main_win.is_minimized().unwrap_or(false) {
                                        if let Some(overlay) = app.get_webview_window("overlay") {
                                            let _ = overlay.show();
                                        }
                                    }
                                }
                            });
                        }
                    }
                    _ => {}
                }
            }
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
            commands::recording::open_microphone_permission_settings,
            commands::recording::check_audio_permissions,
            commands::recording::check_silence_warning,
            commands::meetings::get_meeting_detail,
            commands::transcribe::get_whisper_models,
            commands::transcribe::download_model,
            commands::transcribe::delete_whisper_model,
            commands::transcribe::transcribe_meeting,
            commands::ai::summarize_meeting,
            commands::ai::check_ollama_status,
            commands::ai::install_ollama,
            commands::ai::start_ollama,
            commands::ai::pull_ollama_model,
            commands::overlay::show_overlay,
            commands::overlay::hide_overlay,
            commands::overlay::expand_overlay,
            commands::overlay::collapse_overlay,
            commands::overlay::set_overlay_pill_width,
            commands::overlay::compact_overlay,
            // Dictation commands
            commands::dictation::get_dictation_status,
            commands::dictation::check_accessibility,
            commands::dictation::open_accessibility_settings,
            commands::dictation::get_frontmost_app_name,
            commands::dictation::get_dictation_dictionary,
            commands::dictation::add_dictation_dictionary_entry,
            commands::dictation::remove_dictation_dictionary_entry,
            commands::dictation::get_dictation_snippets,
            commands::dictation::add_dictation_snippet,
            commands::dictation::remove_dictation_snippet,
            commands::dictation::get_dictation_voice_commands,
            commands::dictation::add_dictation_voice_command,
            commands::dictation::remove_dictation_voice_command,
            commands::dictation::get_dictation_history,
            commands::dictation::clear_dictation_history,
            commands::dictation::get_dictation_config,
            commands::dictation::save_dictation_config,
            commands::dictation::start_dictation,
            commands::dictation::stop_dictation,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            match event {
                RunEvent::ExitRequested { .. } => {
                    // Stop active dictation on exit
                    if let Some(dictation_state) = app_handle.try_state::<DictationState>() {
                        dictation_state.stop();
                    }

                    if let Some(recording_state) = app_handle.try_state::<RecordingState>() {
                        let mut lock = match recording_state.active.lock() {
                            Ok(l) => l,
                            Err(_) => return,
                        };
                        if let Some(active) = lock.take() {
                            active.stop_flag.store(true, Ordering::Relaxed);
                            drop(active._mic_stream);
                            drop(active._system_stream);
                            if let Some(thread) = active.writer_thread {
                                let _ = thread.join();
                            }
                            if let Some(db) = app_handle.try_state::<Database>() {
                                let duration = active.started_at.elapsed().as_secs() as i64;
                                let path = active.audio_path.to_string_lossy().to_string();
                                let _ = db.update_meeting_on_stop(active.meeting_id, &path, duration);
                            }
                        }
                    }
                }
                #[cfg(target_os = "macos")]
                RunEvent::Reopen {
                    has_visible_windows,
                    ..
                } => {
                    if !has_visible_windows {
                        if let Some(window) = app_handle.get_webview_window("main") {
                            let _ = window.unminimize();
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                        // Hide overlay when restoring main window
                        if let Some(overlay) = app_handle.get_webview_window("overlay") {
                            let _ = overlay.hide();
                        }
                    }
                }
                _ => {}
            }
        });
}

/// Register global hotkey for dictation (Alt+Space on macOS, Ctrl+Alt+Space elsewhere).
fn register_dictation_hotkey(app: &tauri::AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

    let hotkey = if cfg!(target_os = "macos") {
        "Alt+Space"
    } else {
        "Ctrl+Alt+Space"
    };

    app.global_shortcut().on_shortcut(hotkey, move |app, _shortcut, event| {
        // Only handle key press (not release) for toggle mode
        if event.state != ShortcutState::Pressed {
            return;
        }

        let app_handle = app.clone();
        tauri::async_runtime::spawn(async move {
            let dictation_state = app_handle.state::<DictationState>();

            if dictation_state.is_active() {
                // Stop dictation
                let db = app_handle.state::<Database>();
                let _ = commands::dictation::stop_dictation(db, dictation_state, app_handle.clone()).await;
            } else {
                // Start dictation
                let db = app_handle.state::<Database>();
                let recording = app_handle.state::<audio::state::RecordingState>();
                if let Err(e) = commands::dictation::start_dictation(db, dictation_state, recording, app_handle.clone()).await {
                    log::error!("Failed to start dictation: {}", e);
                }
            }
        });
    })?;

    log::info!("Dictation hotkey registered: {}", hotkey);
    Ok(())
}
