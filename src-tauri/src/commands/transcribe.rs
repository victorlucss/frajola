use std::path::PathBuf;

use serde::Serialize;
use tauri::{AppHandle, Emitter, State};

use crate::db::Database;
use crate::error::AppError;
use crate::transcribe::{model, resample, whisper};

#[derive(Debug, Serialize)]
pub struct ModelStatus {
    pub downloaded: bool,
}

#[tauri::command]
pub fn get_model_status(app: AppHandle) -> ModelStatus {
    ModelStatus {
        downloaded: model::is_model_downloaded(&app),
    }
}

#[tauri::command]
pub async fn download_model(app: AppHandle) -> Result<(), AppError> {
    model::download_model(&app).await?;
    Ok(())
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

    // 2. Set status to 'transcribing'
    db.update_meeting_status(meeting_id, "transcribing")?;

    // 3. Download model if needed
    let model_path = match model::download_model(&app).await {
        Ok(p) => p,
        Err(e) => {
            db.update_meeting_status(meeting_id, "failed")?;
            return Err(e);
        }
    };

    // 4. Load and resample audio (CPU-intensive, run in blocking thread)
    let samples = {
        let path = audio_path.clone();
        tokio::task::spawn_blocking(move || resample::load_and_resample(&path))
            .await
            .map_err(|e| {
                AppError::General(format!("Resample task panicked: {e}"))
            })?
    };

    let samples = match samples {
        Ok(s) => s,
        Err(e) => {
            db.update_meeting_status(meeting_id, "failed")?;
            return Err(e);
        }
    };

    // 5. Run Whisper inference (CPU-intensive, run in blocking thread)
    let language = meeting.language.clone();
    let whisper_result = {
        let mp = model_path.clone();
        let lang = language.clone();
        tokio::task::spawn_blocking(move || {
            whisper::transcribe(&mp, &samples, lang.as_deref())
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

    // 6. Insert transcript segments into DB
    let db_segments: Vec<(Option<&str>, i64, i64, &str)> = segments
        .iter()
        .map(|s| (s.speaker.as_deref(), s.start_ms, s.end_ms, s.text.as_str()))
        .collect();

    if let Err(e) = db.insert_transcript_segments(meeting_id, &db_segments) {
        db.update_meeting_status(meeting_id, "failed")?;
        return Err(e);
    }

    // 7. Emit transcription-complete, then chain summarization
    let _ = app.emit(
        "transcription-complete",
        serde_json::json!({ "meeting_id": meeting_id }),
    );

    // 8. Run AI summarization (sets status to 'summarizing' then 'complete')
    //    On failure, run_summarization logs the error and still sets 'complete'
    if let Err(e) = super::ai::run_summarization(&app, &db, meeting_id).await {
        log::warn!("Summarization failed for meeting {meeting_id}: {e}");
        let _ = db.update_meeting_status(meeting_id, "complete");
    }

    Ok(())
}
