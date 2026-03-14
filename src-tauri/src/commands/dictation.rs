use serde::{Deserialize, Serialize};
use tauri::{Emitter, Manager, State};

use crate::db::dictation::DictationHistoryEntry;
use crate::db::Database;
use crate::dictation::frontmost_app;
use crate::dictation::processor::{
    DictationLlmConfig, DictationSnippet, DictationVoiceCommand, ProcessResult,
};
use crate::dictation::state::{DictationState, SttEngine};
use crate::dictation::text_injector;
use crate::error::AppError;

// ─── Status ──────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct DictationStatus {
    pub is_active: bool,
    pub engine: Option<String>,
}

#[tauri::command]
pub fn get_dictation_status(
    dictation: State<'_, DictationState>,
) -> Result<DictationStatus, AppError> {
    let lock = dictation
        .active
        .lock()
        .map_err(|_| AppError::General("Dictation state lock poisoned".into()))?;

    Ok(DictationStatus {
        is_active: lock.is_some(),
        engine: lock.as_ref().map(|a| match a.engine {
            SttEngine::Apple => "apple".to_string(),
            SttEngine::Whisper => "whisper".to_string(),
        }),
    })
}

/// Fast polling command for audio level — reads an atomic, no locks.
#[tauri::command]
pub fn get_dictation_level(
    dictation: State<'_, DictationState>,
) -> f32 {
    if let Ok(lock) = dictation.active.lock() {
        if let Some(active) = lock.as_ref() {
            return f32::from_bits(active.level_value.load(std::sync::atomic::Ordering::Relaxed));
        }
    }
    0.0
}

// ─── Accessibility ───────────────────────────────────────

#[tauri::command]
pub fn check_accessibility() -> bool {
    text_injector::check_accessibility()
}

#[tauri::command]
pub fn open_accessibility_settings() {
    text_injector::open_accessibility_settings();
}

#[tauri::command]
pub fn get_frontmost_app_name() -> String {
    frontmost_app::get_frontmost_app()
}

// ─── Dictionary CRUD ─────────────────────────────────────

#[tauri::command]
pub fn get_dictation_dictionary(db: State<'_, Database>) -> Result<Vec<String>, AppError> {
    db.get_dictation_dictionary()
}

#[tauri::command]
pub fn add_dictation_dictionary_entry(
    db: State<'_, Database>,
    entry: String,
) -> Result<(), AppError> {
    db.add_dictation_dictionary_entry(&entry)
}

#[tauri::command]
pub fn remove_dictation_dictionary_entry(
    db: State<'_, Database>,
    entry: String,
) -> Result<(), AppError> {
    db.remove_dictation_dictionary_entry(&entry)
}

// ─── Snippets CRUD ───────────────────────────────────────

#[tauri::command]
pub fn get_dictation_snippets(
    db: State<'_, Database>,
) -> Result<Vec<DictationSnippet>, AppError> {
    db.get_dictation_snippets()
}

#[tauri::command]
pub fn add_dictation_snippet(
    db: State<'_, Database>,
    trigger: String,
    expansion: String,
) -> Result<(), AppError> {
    db.add_dictation_snippet(&trigger, &expansion)
}

#[tauri::command]
pub fn remove_dictation_snippet(
    db: State<'_, Database>,
    trigger: String,
) -> Result<(), AppError> {
    db.remove_dictation_snippet(&trigger)
}

// ─── Voice Commands CRUD ─────────────────────────────────

#[tauri::command]
pub fn get_dictation_voice_commands(
    db: State<'_, Database>,
) -> Result<Vec<DictationVoiceCommand>, AppError> {
    db.get_dictation_voice_commands()
}

#[tauri::command]
pub fn add_dictation_voice_command(
    db: State<'_, Database>,
    trigger: String,
    key_combo: String,
) -> Result<(), AppError> {
    db.add_dictation_voice_command(&trigger, &key_combo)
}

#[tauri::command]
pub fn remove_dictation_voice_command(
    db: State<'_, Database>,
    trigger: String,
) -> Result<(), AppError> {
    db.remove_dictation_voice_command(&trigger)
}

// ─── History ─────────────────────────────────────────────

#[tauri::command]
pub fn get_dictation_history(
    db: State<'_, Database>,
    limit: Option<i64>,
) -> Result<Vec<DictationHistoryEntry>, AppError> {
    db.get_dictation_history(limit.unwrap_or(50))
}

#[tauri::command]
pub fn clear_dictation_history(db: State<'_, Database>) -> Result<(), AppError> {
    db.clear_dictation_history()
}

// ─── Config ──────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DictationConfig {
    pub enabled: bool,
    pub hotkey_mode: String,
    pub stt_engine: String,
    pub language: String,
    pub llm_enabled: bool,
    pub llm_correction_level: i32,
    pub llm_provider: String,
    pub llm_model: String,
    pub llm_api_key: String,
    pub llm_endpoint: String,
    pub flow_mode: bool,
    pub code_mode: bool,
}

#[tauri::command]
pub fn get_dictation_config(db: State<'_, Database>) -> Result<DictationConfig, AppError> {
    let get = |key: &str, default: &str| -> String {
        db.get_setting(key)
            .unwrap_or(None)
            .unwrap_or_else(|| default.to_string())
    };

    Ok(DictationConfig {
        enabled: get("dictation_enabled", "1") == "1",
        hotkey_mode: get("dictation_hotkey_mode", "push_to_talk"),
        stt_engine: get("dictation_stt_engine", "whisper"),
        language: get("dictation_language", "en"),
        llm_enabled: get("dictation_llm_enabled", "0") == "1",
        llm_correction_level: get("dictation_llm_correction_level", "3")
            .parse()
            .unwrap_or(3),
        llm_provider: get("dictation_llm_provider", "ollama"),
        llm_model: get("dictation_llm_model", "llama3.2"),
        llm_api_key: get("dictation_llm_api_key", ""),
        llm_endpoint: get("dictation_llm_endpoint", ""),
        flow_mode: get("dictation_flow_mode", "0") == "1",
        code_mode: get("dictation_code_mode", "0") == "1",
    })
}

#[tauri::command]
pub fn save_dictation_config(
    db: State<'_, Database>,
    config: DictationConfig,
) -> Result<(), AppError> {
    db.set_setting("dictation_enabled", if config.enabled { "1" } else { "0" })?;
    db.set_setting("dictation_hotkey_mode", &config.hotkey_mode)?;
    db.set_setting("dictation_stt_engine", &config.stt_engine)?;
    db.set_setting("dictation_language", &config.language)?;
    db.set_setting(
        "dictation_llm_enabled",
        if config.llm_enabled { "1" } else { "0" },
    )?;
    db.set_setting(
        "dictation_llm_correction_level",
        &config.llm_correction_level.to_string(),
    )?;
    db.set_setting("dictation_llm_provider", &config.llm_provider)?;
    db.set_setting("dictation_llm_model", &config.llm_model)?;
    db.set_setting("dictation_llm_api_key", &config.llm_api_key)?;
    db.set_setting("dictation_llm_endpoint", &config.llm_endpoint)?;
    db.set_setting(
        "dictation_flow_mode",
        if config.flow_mode { "1" } else { "0" },
    )?;
    db.set_setting(
        "dictation_code_mode",
        if config.code_mode { "1" } else { "0" },
    )?;
    Ok(())
}

// ─── Start / Stop Dictation ──────────────────────────────

#[tauri::command]
pub async fn start_dictation(
    db: State<'_, Database>,
    dictation: State<'_, DictationState>,
    recording: State<'_, crate::audio::state::RecordingState>,
    app: tauri::AppHandle,
) -> Result<(), AppError> {
    // Check if already dictating
    if dictation.is_active() {
        return Err(AppError::General("Already dictating".into()));
    }

    // Check if meeting recording is active (mutually exclusive)
    {
        let lock = recording
            .active
            .lock()
            .map_err(|_| AppError::General("Recording state lock poisoned".into()))?;
        if lock.is_some() {
            return Err(AppError::General(
                "Cannot dictate while recording a meeting".into(),
            ));
        }
    }

    let engine_str = db
        .get_setting("dictation_stt_engine")?
        .unwrap_or_else(|| "whisper".to_string());
    let engine = SttEngine::from_str(&engine_str);
    let language = db
        .get_setting("dictation_language")?
        .unwrap_or_else(|| "en".to_string());

    match engine {
        SttEngine::Apple => {
            #[cfg(target_os = "macos")]
            {
                start_apple_speech_dictation(&dictation, &app, &language)?;
            }
            #[cfg(not(target_os = "macos"))]
            {
                return Err(AppError::General(
                    "Apple Speech is only available on macOS".into(),
                ));
            }
        }
        SttEngine::Whisper => {
            start_whisper_dictation(&dictation, &app, &language)?;
        }
    }

    let _ = app.emit("dictation-started", ());
    Ok(())
}

#[cfg(target_os = "macos")]
fn start_apple_speech_dictation(
    dictation: &State<'_, DictationState>,
    app: &tauri::AppHandle,
    language: &str,
) -> Result<(), AppError> {
    use crate::dictation::apple_speech;
    use crate::dictation::state::ActiveDictation;
    use std::sync::atomic::AtomicBool;
    use std::sync::Arc;

    let app_handle = app.clone();
    let app_handle2 = app.clone();
    let app_handle3 = app.clone();

    // Track last partial text length to derive speaking activity
    let last_partial_len = std::sync::Arc::new(std::sync::atomic::AtomicUsize::new(0));
    let last_partial_len2 = last_partial_len.clone();

    let callbacks = apple_speech::SpeechCallbacks {
        on_result: Box::new(move |text: &str, is_final: bool| {
            if is_final {
                let text = text.to_string();
                let handle = app_handle.clone();
                // Reset level when done
                let _ = app_handle.emit("dictation-audio-level", 0.0_f32);
                tauri::async_runtime::spawn(async move {
                    handle_dictation_result(&handle, &text).await;
                });
            } else {
                let _ = app_handle.emit("dictation-partial-result", text);
                // Derive level from text changes — if text is growing, user is speaking
                let new_len = text.len();
                let old_len = last_partial_len.swap(new_len, std::sync::atomic::Ordering::Relaxed);
                let level: f32 = if new_len > old_len {
                    // Speaking — emit a random-ish level based on text growth
                    let growth = (new_len - old_len) as f32;
                    (0.4 + (growth / 10.0).min(0.6)).min(1.0)
                } else {
                    0.15
                };
                let _ = app_handle.emit("dictation-audio-level", level);
            }
        }),
        on_level: Box::new(move |level: f32| {
            // Swift level callback (may not fire on all macOS versions)
            let _ = app_handle2.emit("dictation-audio-level", level);
            last_partial_len2.store(0, std::sync::atomic::Ordering::Relaxed);
        }),
        on_error: Box::new(move |error: &str| {
            log::error!("Apple Speech error: {}", error);
            let _ = app_handle3.emit("dictation-error", error);
        }),
    };

    apple_speech::start(language, callbacks);

    // Start mic level monitor (separate cpal stream for audio visualization)
    let stop_flag = Arc::new(AtomicBool::new(false));
    let (level_stream, level_value) = crate::dictation::mic_level::start_level_monitor(
        stop_flag.clone(),
    )
    .map(|(s, v)| (Some(s), v))
    .unwrap_or_else(|_| (None, std::sync::Arc::new(std::sync::atomic::AtomicU32::new(0))));

    let mut lock = dictation
        .active
        .lock()
        .map_err(|_| AppError::General("Dictation state lock poisoned".into()))?;
    *lock = Some(ActiveDictation {
        stop_flag,
        mic_stream: None,
        level_stream,
        level_value,
        audio_path: None,
        engine: SttEngine::Apple,
    });

    Ok(())
}

fn start_whisper_dictation(
    dictation: &State<'_, DictationState>,
    app: &tauri::AppHandle,
    _language: &str,
) -> Result<(), AppError> {
    use crate::audio::capture::start_capture;
    use crate::dictation::state::ActiveDictation;
    use std::sync::atomic::AtomicBool;
    use std::sync::Arc;

    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::General(e.to_string()))?;
    let temp_dir = app_data_dir.join("recordings");
    std::fs::create_dir_all(&temp_dir)?;

    let audio_path = temp_dir.join(format!("_dictation_{}.wav", uuid::Uuid::new_v4()));
    let stop_flag = Arc::new(std::sync::atomic::AtomicBool::new(false));
    let paused_flag = Arc::new(AtomicBool::new(false));

    let handles = start_capture(
        None,
        false, // mic only for dictation
        &audio_path,
        stop_flag.clone(),
        paused_flag,
    )
    .map_err(AppError::Audio)?;

    let mut lock = dictation
        .active
        .lock()
        .map_err(|_| AppError::General("Dictation state lock poisoned".into()))?;
    // Start mic level monitor for whisper mode too
    let (level_stream, level_value) = crate::dictation::mic_level::start_level_monitor(
        stop_flag.clone(),
    )
    .map(|(s, v)| (Some(s), v))
    .unwrap_or_else(|_| (None, std::sync::Arc::new(std::sync::atomic::AtomicU32::new(0))));

    *lock = Some(ActiveDictation {
        stop_flag,
        mic_stream: handles.mic_stream,
        level_stream,
        level_value,
        audio_path: Some(audio_path),
        engine: SttEngine::Whisper,
    });

    Ok(())
}

#[tauri::command]
pub async fn stop_dictation(
    db: State<'_, Database>,
    dictation: State<'_, DictationState>,
    app: tauri::AppHandle,
) -> Result<(), AppError> {
    let active = {
        let mut lock = dictation
            .active
            .lock()
            .map_err(|_| AppError::General("Dictation state lock poisoned".into()))?;
        lock.take()
            .ok_or_else(|| AppError::General("Not dictating".into()))?
    };

    match active.engine {
        SttEngine::Apple => {
            #[cfg(target_os = "macos")]
            {
                crate::dictation::apple_speech::stop();
                // Apple Speech handles result delivery via callback
            }
        }
        SttEngine::Whisper => {
            // Stop recording
            active
                .stop_flag
                .store(true, std::sync::atomic::Ordering::Relaxed);
            drop(active.mic_stream);

            // Small delay for the writer thread to finish
            tokio::time::sleep(std::time::Duration::from_millis(200)).await;

            // Transcribe the recorded audio
            if let Some(audio_path) = &active.audio_path {
                if audio_path.exists() {
                    let _ = app.emit("dictation-processing", ());

                    let whisper_model = db
                        .get_setting("whisper_model")?
                        .unwrap_or_else(|| "base".to_string());
                    let language = db
                        .get_setting("dictation_language")?
                        .unwrap_or_else(|| "en".to_string());

                    let model_path = crate::transcribe::model::model_path(&app, &whisper_model);

                    if let Some(model_path) = model_path {
                        if model_path.exists() {
                            match transcribe_dictation_audio(audio_path, &model_path, &language) {
                                Ok(text) if !text.is_empty() => {
                                    handle_dictation_result(&app, &text).await;
                                }
                                Ok(_) => {
                                    log::warn!("Whisper returned empty transcription");
                                }
                                Err(e) => {
                                    log::error!("Whisper transcription failed: {}", e);
                                    let _ = app.emit("dictation-error", e.to_string());
                                }
                            }
                        } else {
                            let _ = app.emit(
                                "dictation-error",
                                "Whisper model not downloaded. Please download a model in Settings.",
                            );
                        }
                    } else {
                        let _ = app.emit(
                            "dictation-error",
                            "No whisper model configured.",
                        );
                    }

                    // Clean up temp audio file
                    let _ = std::fs::remove_file(audio_path);
                }
            }
        }
    }

    let _ = app.emit("dictation-stopped", ());
    Ok(())
}

fn transcribe_dictation_audio(
    audio_path: &std::path::Path,
    model_path: &std::path::Path,
    language: &str,
) -> Result<String, AppError> {
    let (samples, _energy) = crate::transcribe::resample::load_and_resample_with_energy(audio_path)?;

    let lang = if language.is_empty() {
        None
    } else {
        Some(language)
    };

    let segments = crate::transcribe::whisper::transcribe(model_path, &samples, lang, None)?;

    let text: String = segments
        .iter()
        .map(|s| s.text.as_str())
        .collect::<Vec<_>>()
        .join(" ");

    Ok(text.trim().to_string())
}

/// Handle a completed dictation transcription: process through pipeline and inject.
async fn handle_dictation_result(app: &tauri::AppHandle, raw_text: &str) {
    if raw_text.trim().is_empty() {
        return;
    }

    let _ = app.emit("dictation-processing", ());

    let db = app.state::<Database>();

    // Load pipeline data from DB
    let snippets = db.get_dictation_snippets().unwrap_or_default();
    let voice_commands = db.get_dictation_voice_commands().unwrap_or_default();
    let dictionary = db.get_dictation_dictionary().unwrap_or_default();

    // Build LLM config from settings
    let llm_config = build_llm_config(&db);

    let target_app = frontmost_app::get_frontmost_app();

    // Process through pipeline
    let result = crate::dictation::processor::process_transcription(
        raw_text,
        &snippets,
        &voice_commands,
        &dictionary,
        &llm_config,
        &target_app,
    )
    .await;

    let flow_mode = db
        .get_setting("dictation_flow_mode")
        .unwrap_or(None)
        .map(|v| v == "1")
        .unwrap_or(false);

    let engine_str = db
        .get_setting("dictation_stt_engine")
        .unwrap_or(None)
        .unwrap_or_else(|| "whisper".to_string());

    match &result {
        ProcessResult::Text(text) | ProcessResult::Snippet(text) => {
            let success = text_injector::inject_text(text, flow_mode);
            if !success {
                text_injector::open_accessibility_settings();
                let _ = app.emit("dictation-error", "Accessibility permission required");
            }

            // Log to history
            let _ = db.add_dictation_history(
                raw_text,
                text,
                Some(&target_app),
                Some(&engine_str),
            );
        }
        ProcessResult::KeyCombo(combo) => {
            text_injector::simulate_key_combo(combo);

            let _ = db.add_dictation_history(
                raw_text,
                &format!("[key combo: {}]", combo),
                Some(&target_app),
                Some(&engine_str),
            );
        }
    }

    let _ = app.emit("dictation-completed", ());
}

fn build_llm_config(db: &Database) -> DictationLlmConfig {
    let get = |key: &str, default: &str| -> String {
        db.get_setting(key)
            .unwrap_or(None)
            .unwrap_or_else(|| default.to_string())
    };

    DictationLlmConfig {
        enabled: get("dictation_llm_enabled", "0") == "1",
        provider: get("dictation_llm_provider", "ollama"),
        model: get("dictation_llm_model", "llama3.2"),
        api_key: get("dictation_llm_api_key", ""),
        endpoint: get("dictation_llm_endpoint", ""),
        correction_level: get("dictation_llm_correction_level", "3")
            .parse()
            .unwrap_or(3),
        system_prompt: crate::dictation::processor::default_dictation_prompt(),
        code_mode: get("dictation_code_mode", "0") == "1",
    }
}
