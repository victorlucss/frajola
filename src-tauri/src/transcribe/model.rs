use std::path::PathBuf;

use futures_util::StreamExt;
use tauri::{AppHandle, Emitter, Manager};

use crate::error::AppError;

const MODEL_FILENAME: &str = "ggml-base.bin";
const MODEL_URL: &str =
    "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin";

/// Directory where Whisper models are stored.
pub fn models_dir(app: &AppHandle) -> PathBuf {
    let app_data = app
        .path()
        .app_data_dir()
        .expect("failed to resolve app data dir");
    app_data.join("models")
}

/// Full path to the current model binary.
pub fn model_path(app: &AppHandle) -> PathBuf {
    models_dir(app).join(MODEL_FILENAME)
}

/// Check whether the model has already been downloaded.
pub fn is_model_downloaded(app: &AppHandle) -> bool {
    model_path(app).exists()
}

/// Download the Whisper model from HuggingFace if not already present.
///
/// Emits `"model-download-progress"` events with `{ percent: u8 }` payload.
/// Writes to a `.tmp` file first, then renames atomically.
pub async fn download_model(app: &AppHandle) -> Result<PathBuf, AppError> {
    let path = model_path(app);

    if path.exists() {
        return Ok(path);
    }

    let dir = models_dir(app);
    std::fs::create_dir_all(&dir)?;

    let tmp_path = dir.join(format!("{MODEL_FILENAME}.tmp"));

    let response = reqwest::get(MODEL_URL)
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
                let _ = app.emit("model-download-progress", serde_json::json!({ "percent": percent }));
            }
        }
    }

    file.flush()?;
    drop(file);

    std::fs::rename(&tmp_path, &path)?;

    Ok(path)
}
