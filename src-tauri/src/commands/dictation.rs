use serde::{Deserialize, Serialize};
use tauri::{Emitter, Manager, State};

use crate::db::dictation::DictationHistoryEntry;
use crate::db::Database;
use crate::dictation::frontmost_app;
use crate::dictation::processor::{
    DictationLlmConfig, DictationSnippet, DictationVoiceCommand, ProcessResult,
};
use crate::dictation::state::DictationState;
use crate::dictation::text_injector;
use crate::error::AppError;

// ─── Status ──────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct DictationStatus {
    pub is_active: bool,
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

    let language = db
        .get_setting("dictation_language")?
        .unwrap_or_else(|| "en".to_string());

    start_whisper_dictation(&dictation, &app, &language)?;

    let _ = app.emit("dictation-started", ());
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

    // Honour the user's mic_device_id preference (General settings). Empty or
    // unset → cpal's default input device.
    let db = app.state::<Database>();
    let mic_device_id = db
        .get_setting("mic_device_id")
        .ok()
        .flatten()
        .filter(|s| !s.is_empty());

    let handles = start_capture(
        mic_device_id.as_deref(),
        false, // mic only for dictation
        &audio_path,
        stop_flag.clone(),
        paused_flag,
    )
    .map_err(AppError::Audio)?;

    // Level is written directly from the capture stream's audio callback, so
    // we don't open a second cpal stream (macOS occasionally starves the
    // secondary client and the waveform flatlines).
    let level_value = handles.mic_level.clone();

    let mut lock = dictation
        .active
        .lock()
        .map_err(|_| AppError::General("Dictation state lock poisoned".into()))?;
    if lock.is_some() {
        return Err(AppError::General("Already dictating".into()));
    }

    *lock = Some(ActiveDictation {
        stop_flag,
        mic_stream: handles.mic_stream,
        level_stream: None,
        level_value,
        audio_path: Some(audio_path),
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

    // Signal the capture stream + writer thread to stop, then drop the
    // stream so cpal releases the device.
    active
        .stop_flag
        .store(true, std::sync::atomic::Ordering::Relaxed);
    drop(active.mic_stream);
    drop(active.level_stream);

    // Small grace period for the writer thread to drain & finalize WAV.
    // (The capture layer's writer thread owns the file and closes it when
    // the sender side is dropped; the drop above releases the tx clone.)
    tokio::time::sleep(std::time::Duration::from_millis(250)).await;

    let Some(audio_path) = active.audio_path.clone() else {
        let _ = app.emit("dictation-stopped", ());
        return Ok(());
    };

    if !audio_path.exists() {
        let _ = app.emit("dictation-stopped", ());
        return Ok(());
    }

    let _ = app.emit("dictation-processing", ());

    let whisper_model = db
        .get_setting("whisper_model")?
        .unwrap_or_else(|| "base".to_string());
    let language = db
        .get_setting("dictation_language")?
        .unwrap_or_else(|| "en".to_string());

    let Some(model_path) = crate::transcribe::model::model_path(&app, &whisper_model) else {
        let _ = app.emit("dictation-error", "No whisper model configured.");
        let _ = std::fs::remove_file(&audio_path);
        let _ = app.emit("dictation-stopped", ());
        return Ok(());
    };

    if !model_path.exists() {
        let _ = app.emit(
            "dictation-error",
            "Whisper model not downloaded. Please download a model in Settings.",
        );
        let _ = std::fs::remove_file(&audio_path);
        let _ = app.emit("dictation-stopped", ());
        return Ok(());
    }

    // Whisper inference is heavy CPU work; keep it off the tokio worker.
    let lang = language.clone();
    let audio_for_task = audio_path.clone();
    let model_for_task = model_path.clone();
    let join = tauri::async_runtime::spawn_blocking(move || {
        transcribe_dictation_audio(&audio_for_task, &model_for_task, &lang)
    });

    match join.await {
        Ok(Ok(text)) if !text.is_empty() => {
            handle_dictation_result(&app, &text).await;
        }
        Ok(Ok(_)) => {
            log::warn!("Whisper returned empty transcription");
            let _ = app.emit(
                "dictation-error",
                "No speech detected — check your microphone input and volume.",
            );
        }
        Ok(Err(e)) => {
            log::error!("Whisper transcription failed: {}", e);
            let _ = app.emit("dictation-error", e.to_string());
        }
        Err(e) => {
            log::error!("Whisper task panicked: {}", e);
            let _ = app.emit("dictation-error", format!("Transcription task failed: {e}"));
        }
    }

    let _ = std::fs::remove_file(&audio_path);

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
    let mut llm_config = build_llm_config(&db);

    // If LLM cleanup is on with the Ollama provider but the configured model
    // isn't pulled yet, kick off a pull in the background and skip LLM
    // cleanup for this run (so the user still gets their text pasted).
    if llm_config.enabled && llm_config.provider == "ollama" {
        if !ollama_model_present(&llm_config.model, &llm_config.endpoint).await {
            let _ = app.emit(
                "dictation-llm-model-pulling",
                serde_json::json!({ "model": llm_config.model }),
            );
            let app_clone = app.clone();
            let model_clone = llm_config.model.clone();
            tauri::async_runtime::spawn(async move {
                if let Err(e) = pull_ollama_model_internal(&app_clone, &model_clone).await {
                    log::warn!("Auto-pull of Ollama model {model_clone} failed: {e}");
                }
            });
            // Disable LLM for this dictation; raw transcription is still good.
            llm_config.enabled = false;
        }
    }

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

    match &result {
        ProcessResult::Text(text) | ProcessResult::Snippet(text) => {
            // text_injector blocks (clipboard + main-thread paste); keep it off
            // the tokio runtime.
            let text_clone = text.clone();
            let success = tauri::async_runtime::spawn_blocking(move || {
                text_injector::inject_text(&text_clone, flow_mode)
            })
            .await
            .unwrap_or(false);

            if !success {
                text_injector::open_accessibility_settings();
                let _ = app.emit("dictation-error", "Accessibility permission required");
            }

            let _ = db.add_dictation_history(
                raw_text,
                text,
                Some(&target_app),
                Some("whisper"),
            );
        }
        ProcessResult::KeyCombo(combo) => {
            let combo_clone = combo.clone();
            let _ = tauri::async_runtime::spawn_blocking(move || {
                text_injector::simulate_key_combo(&combo_clone);
            })
            .await;

            let _ = db.add_dictation_history(
                raw_text,
                &format!("[key combo: {}]", combo),
                Some(&target_app),
                Some("whisper"),
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

/// Returns true if the given model name (with or without :tag) is among
/// Ollama's locally available models. False if Ollama isn't reachable.
async fn ollama_model_present(model: &str, endpoint: &str) -> bool {
    use crate::ai::ollama::OllamaClient;
    // The endpoint setting may include the chat-completions path; strip down
    // to the base. Empty → use OllamaClient default.
    let base = endpoint
        .trim_end_matches('/')
        .trim_end_matches("/v1/chat/completions")
        .trim_end_matches("/api/chat")
        .trim_end_matches("/api/generate");
    let client = if base.is_empty() {
        OllamaClient::new(None)
    } else {
        OllamaClient::new(Some(base))
    };
    let status = client.check_status().await;
    if !status.available {
        return false;
    }
    // Ollama lists models as `name:tag`; match by stripping the `:tag` if the
    // user wrote a bare name like `llama3.2`.
    let want = model.trim();
    status.models.iter().any(|m| {
        m == want || m.split(':').next().map(|n| n == want).unwrap_or(false)
    })
}

/// Re-uses the public `pull_ollama_model` flow but without going through the
/// IPC layer — emits the same `ollama-pull-progress` events so any UI that
/// already listens (e.g. an Ollama settings tab) reflects progress.
async fn pull_ollama_model_internal(
    app: &tauri::AppHandle,
    model: &str,
) -> Result<(), AppError> {
    crate::commands::ai::pull_ollama_model(app.clone(), model.to_string()).await
}
