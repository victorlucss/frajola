use std::path::PathBuf;

use futures_util::StreamExt;
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};

use crate::error::AppError;

pub struct WhisperModelDef {
    pub key: &'static str,
    pub label: &'static str,
    pub filename: &'static str,
    pub url: &'static str,
    pub size_label: &'static str,
}

pub const WHISPER_MODELS: &[WhisperModelDef] = &[
    WhisperModelDef {
        key: "tiny",
        label: "Tiny",
        filename: "ggml-tiny.bin",
        url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin",
        size_label: "~75 MB",
    },
    WhisperModelDef {
        key: "base",
        label: "Base",
        filename: "ggml-base.bin",
        url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin",
        size_label: "~142 MB",
    },
    WhisperModelDef {
        key: "small",
        label: "Small",
        filename: "ggml-small.bin",
        url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin",
        size_label: "~466 MB",
    },
    WhisperModelDef {
        key: "medium",
        label: "Medium",
        filename: "ggml-medium.bin",
        url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin",
        size_label: "~1.5 GB",
    },
];

pub fn find_model(key: &str) -> Option<&'static WhisperModelDef> {
    WHISPER_MODELS.iter().find(|m| m.key == key)
}

/// Directory where Whisper models are stored.
pub fn models_dir(app: &AppHandle) -> PathBuf {
    let app_data = app
        .path()
        .app_data_dir()
        .expect("failed to resolve app data dir");
    app_data.join("models")
}

/// Full path to a model binary by key.
pub fn model_path(app: &AppHandle, model_key: &str) -> Option<PathBuf> {
    find_model(model_key).map(|m| models_dir(app).join(m.filename))
}

/// Check whether a model has already been downloaded.
pub fn is_model_downloaded(app: &AppHandle, model_key: &str) -> bool {
    model_path(app, model_key).map_or(false, |p| p.exists())
}

#[derive(Debug, Serialize)]
pub struct WhisperModelStatus {
    pub key: String,
    pub label: String,
    pub size_label: String,
    pub downloaded: bool,
}

/// Return status of all whisper models.
pub fn get_all_models_status(app: &AppHandle) -> Vec<WhisperModelStatus> {
    WHISPER_MODELS
        .iter()
        .map(|m| WhisperModelStatus {
            key: m.key.to_string(),
            label: m.label.to_string(),
            size_label: m.size_label.to_string(),
            downloaded: is_model_downloaded(app, m.key),
        })
        .collect()
}

/// Download a Whisper model by key.
///
/// Emits `"model-download-progress"` events with `{ model: &str, percent: u8 }` payload.
/// Writes to a `.tmp` file first, then renames atomically.
pub async fn download_model(app: &AppHandle, model_key: &str) -> Result<PathBuf, AppError> {
    let model_def = find_model(model_key)
        .ok_or_else(|| AppError::General(format!("Unknown model key: {model_key}")))?;

    let dir = models_dir(app);
    let path = dir.join(model_def.filename);

    if path.exists() {
        return Ok(path);
    }

    std::fs::create_dir_all(&dir)?;

    let tmp_path = dir.join(format!("{}.tmp", model_def.filename));

    let response = reqwest::get(model_def.url)
        .await
        .map_err(|e| AppError::General(format!("Model download request failed: {e}")))?;

    let total_size = response.content_length().unwrap_or(0);
    let mut downloaded: u64 = 0;
    let mut last_percent: u8 = 0;

    let mut file = std::fs::File::create(&tmp_path)?;
    let mut stream = response.bytes_stream();

    use std::io::Write;
    while let Some(chunk) = stream.next().await {
        let chunk =
            chunk.map_err(|e| AppError::General(format!("Download stream error: {e}")))?;
        file.write_all(&chunk)?;
        downloaded += chunk.len() as u64;

        if total_size > 0 {
            let percent = ((downloaded as f64 / total_size as f64) * 100.0) as u8;
            if percent != last_percent {
                last_percent = percent;
                let _ = app.emit(
                    "model-download-progress",
                    serde_json::json!({ "model": model_key, "percent": percent }),
                );
            }
        }
    }

    file.flush()?;
    drop(file);

    std::fs::rename(&tmp_path, &path)?;

    Ok(path)
}

/// Delete a downloaded model file.
pub fn delete_model(app: &AppHandle, model_key: &str) -> Result<(), AppError> {
    let model_def = find_model(model_key)
        .ok_or_else(|| AppError::General(format!("Unknown model key: {model_key}")))?;

    let path = models_dir(app).join(model_def.filename);
    if path.exists() {
        std::fs::remove_file(&path)?;
    }
    Ok(())
}
