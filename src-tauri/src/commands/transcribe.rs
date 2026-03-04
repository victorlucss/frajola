use std::path::PathBuf;

use tauri::{AppHandle, Emitter, State};

use crate::db::Database;
use crate::error::AppError;
use crate::transcribe::{model, resample, whisper};

#[tauri::command]
pub fn get_whisper_models(app: AppHandle) -> Vec<model::WhisperModelStatus> {
    model::get_all_models_status(&app)
}

#[tauri::command]
pub async fn download_model(app: AppHandle, model_key: String) -> Result<(), AppError> {
    model::download_model(&app, &model_key).await?;
    Ok(())
}

#[tauri::command]
pub fn delete_whisper_model(app: AppHandle, model_key: String) -> Result<(), AppError> {
    model::delete_model(&app, &model_key)
}

#[tauri::command]
pub async fn transcribe_meeting(
    app: AppHandle,
    db: State<'_, Database>,
    meeting_id: i64,
) -> Result<(), AppError> {
    // 1. Get the meeting and validate it has an audio path
    let meeting = db
        .get_meeting(meeting_id)?
        .ok_or_else(|| AppError::General("Meeting not found".into()))?;

    let audio_path = meeting
        .audio_path
        .ok_or_else(|| AppError::General("Meeting has no audio file".into()))?;

    let audio_path = PathBuf::from(&audio_path);
    if !audio_path.exists() {
        return Err(AppError::General(format!(
            "Audio file not found: {}",
            audio_path.display()
        )));
    }

    // 2. Clear old generated data (transcript, summaries, action items) and set status
    db.clear_meeting_generated_data(meeting_id)?;
    db.update_meeting_status(meeting_id, "transcribing")?;

    // 3. Determine which model to use from settings (default: "base")
    let model_key = db
        .get_setting("whisper_model")?
        .unwrap_or_else(|| "base".to_string());

    // 4. Download model if needed
    let model_path = match model::download_model(&app, &model_key).await {
        Ok(p) => p,
        Err(e) => {
            db.update_meeting_status(meeting_id, "failed")?;
            return Err(e);
        }
    };

    // 5. Load and resample audio with energy extraction (CPU-intensive, run in blocking thread)
    let resample_result = {
        let path = audio_path.clone();
        tokio::task::spawn_blocking(move || resample::load_and_resample_with_energy(&path))
            .await
            .map_err(|e| {
                AppError::General(format!("Resample task panicked: {e}"))
            })?
    };

    let (samples, energy) = match resample_result {
        Ok(r) => r,
        Err(e) => {
            db.update_meeting_status(meeting_id, "failed")?;
            return Err(e);
        }
    };

    // 6. Run Whisper inference (CPU-intensive, run in blocking thread)
    // Let Whisper auto-detect the language from the audio
    let whisper_result = {
        let mp = model_path.clone();
        tokio::task::spawn_blocking(move || {
            whisper::transcribe(&mp, &samples, None, energy.as_deref())
        })
        .await
        .map_err(|e| AppError::General(format!("Whisper task panicked: {e}")))?
    };

    let segments = match whisper_result {
        Ok(s) => s,
        Err(e) => {
            db.update_meeting_status(meeting_id, "failed")?;
            return Err(e);
        }
    };

    // 7. Insert transcript segments into DB
    let db_segments: Vec<(Option<&str>, i64, i64, &str)> = segments
        .iter()
        .map(|s| (s.speaker.as_deref(), s.start_ms, s.end_ms, s.text.as_str()))
        .collect();

    if let Err(e) = db.insert_transcript_segments(meeting_id, &db_segments) {
        db.update_meeting_status(meeting_id, "failed")?;
        return Err(e);
    }

    // 8. Emit transcription-complete, then chain summarization
    let _ = app.emit(
        "transcription-complete",
        serde_json::json!({ "meeting_id": meeting_id }),
    );

    // 9. Optional AI summarization (controlled by settings).
    let ai_enabled = db
        .get_setting("ai_enabled")?
        .map(|v| v == "1" || v.eq_ignore_ascii_case("true"))
        .unwrap_or(true);

    if ai_enabled {
        if let Err(e) = super::ai::run_summarization(&app, &db, meeting_id).await {
            log::warn!("Summarization failed for meeting {meeting_id}: {e}");
            let _ = db.update_meeting_status(meeting_id, "complete");
        }
    } else {
        db.update_meeting_status(meeting_id, "complete")?;
    }

    Ok(())
}
