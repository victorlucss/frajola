use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Instant;

use serde::Serialize;
use tauri::{Emitter, Manager, State};

use crate::audio::capture::start_capture;
use crate::audio::devices::{self, AudioDevice};
use crate::audio::state::{ActiveRecording, RecordingState};
use crate::db::meetings::Meeting;
use crate::db::Database;
use crate::error::AppError;

#[derive(Debug, Serialize)]
pub struct RecordingStatus {
    pub meeting_id: i64,
    pub elapsed_seconds: u64,
    pub is_paused: bool,
}

#[derive(Debug, Serialize)]
pub struct StartRecordingResult {
    pub meeting: Meeting,
}

#[derive(Debug, Serialize)]
pub struct AudioPermissionStatus {
    pub microphone: bool,
    pub system_audio: bool,
    pub error: Option<String>,
}

#[tauri::command]
pub async fn start_recording(
    db: State<'_, Database>,
    recording: State<'_, RecordingState>,
    app: tauri::AppHandle,
    mic_device_id: Option<String>,
    capture_system_audio: Option<bool>,
) -> Result<StartRecordingResult, AppError> {
    {
        let Ok(lock) = recording.active.lock() else {
            return Err(AppError::Audio("Recording state lock poisoned".into()));
        };
        if lock.is_some() {
            return Err(AppError::Audio("Already recording".into()));
        }
    }

    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::General(e.to_string()))?;
    let recordings_dir = app_data_dir.join("recordings");
    std::fs::create_dir_all(&recordings_dir)?;

    // Use a temporary file name; we'll rename after creating the meeting row.
    let temp_audio_path = recordings_dir.join(format!("_recording_{}.wav", std::process::id()));

    let stop_flag = Arc::new(AtomicBool::new(false));
    let paused_flag = Arc::new(AtomicBool::new(false));

    // Attempt capture BEFORE creating the meeting row.
    // If mic capture itself fails (e.g. no mic available), this returns Err
    // and no orphaned meeting is created.
    let handles = start_capture(
        mic_device_id.as_deref(),
        capture_system_audio.unwrap_or(true),
        &temp_audio_path,
        stop_flag.clone(),
        paused_flag.clone(),
    )
    .map_err(AppError::Audio)?;

    // If system audio was requested but failed, abort entirely.
    if let Some(err) = handles.system_audio_error {
        stop_flag.store(true, Ordering::Relaxed);
        drop(handles.mic_stream);
        drop(handles.system_stream);
        let _ = handles.writer_thread.join();
        let _ = std::fs::remove_file(&temp_audio_path);

        return Err(AppError::Audio(format!(
            "System audio capture unavailable: {err}. \
             Grant permission in System Settings → Privacy & Security → \
             Screen & System Audio Recording."
        )));
    }

    // All permissions OK — now create the meeting row.
    let meeting = db.create_meeting()?;

    // Rename temp file to use the meeting ID.
    // The writer thread holds an open file descriptor, so rename is safe (fd follows inode).
    let audio_path = recordings_dir.join(format!("{}.wav", meeting.id));
    std::fs::rename(&temp_audio_path, &audio_path)?;

    let Ok(mut lock) = recording.active.lock() else {
        return Err(AppError::Audio("Recording state lock poisoned".into()));
    };
    *lock = Some(ActiveRecording {
        meeting_id: meeting.id,
        audio_path,
        started_at: Instant::now(),
        stop_flag,
        paused_flag,
        silence_warning: handles.silence_warning,
        writer_thread: Some(handles.writer_thread),
        _mic_stream: handles.mic_stream,
        _system_stream: handles.system_stream,
    });

    let _ = app.emit("recording-started", serde_json::json!({ "meeting_id": meeting.id }));

    Ok(StartRecordingResult { meeting })
}

#[tauri::command]
pub async fn stop_recording(
    db: State<'_, Database>,
    recording: State<'_, RecordingState>,
    app: tauri::AppHandle,
) -> Result<Meeting, AppError> {
    let active = {
        let Ok(mut lock) = recording.active.lock() else {
            return Err(AppError::Audio("Recording state lock poisoned".into()));
        };
        lock.take()
            .ok_or_else(|| AppError::Audio("Not recording".into()))?
    };

    let meeting_id = active.meeting_id;
    active.stop_flag.store(true, Ordering::Relaxed);

    // Drop streams to stop audio capture
    drop(active._mic_stream);
    drop(active._system_stream);

    if let Some(thread) = active.writer_thread {
        thread
            .join()
            .map_err(|_| AppError::Audio("Writer thread panicked".into()))?
            .map_err(AppError::Audio)?;
    }

    let duration_seconds = active.started_at.elapsed().as_secs() as i64;
    let audio_path_str = active.audio_path.to_string_lossy().to_string();
    db.update_meeting_on_stop(active.meeting_id, &audio_path_str, duration_seconds)?;

    let _ = app.emit("recording-stopped", serde_json::json!({ "meeting_id": meeting_id }));

    db.get_meeting(active.meeting_id)?
        .ok_or_else(|| AppError::General("Meeting not found after stop".into()))
}

#[tauri::command]
pub async fn pause_recording(
    recording: State<'_, RecordingState>,
    app: tauri::AppHandle,
) -> Result<(), AppError> {
    let Ok(lock) = recording.active.lock() else {
        return Err(AppError::Audio("Recording state lock poisoned".into()));
    };
    let active = lock
        .as_ref()
        .ok_or_else(|| AppError::Audio("Not recording".into()))?;
    active.paused_flag.store(true, Ordering::Relaxed);
    let _ = app.emit("recording-paused", ());
    Ok(())
}

#[tauri::command]
pub async fn resume_recording(
    recording: State<'_, RecordingState>,
    app: tauri::AppHandle,
) -> Result<(), AppError> {
    let Ok(lock) = recording.active.lock() else {
        return Err(AppError::Audio("Recording state lock poisoned".into()));
    };
    let active = lock
        .as_ref()
        .ok_or_else(|| AppError::Audio("Not recording".into()))?;
    active.paused_flag.store(false, Ordering::Relaxed);
    let _ = app.emit("recording-resumed", ());
    Ok(())
}

#[tauri::command]
pub async fn get_recording_status(
    recording: State<'_, RecordingState>,
) -> Result<Option<RecordingStatus>, AppError> {
    let Ok(lock) = recording.active.lock() else {
        return Err(AppError::Audio("Recording state lock poisoned".into()));
    };
    Ok(lock.as_ref().map(|active| RecordingStatus {
        meeting_id: active.meeting_id,
        elapsed_seconds: active.started_at.elapsed().as_secs(),
        is_paused: active.paused_flag.load(Ordering::Relaxed),
    }))
}

#[tauri::command]
pub fn list_audio_devices() -> Result<Vec<AudioDevice>, AppError> {
    devices::list_all_devices().map_err(AppError::Audio)
}

/// Check whether the writer thread has detected silent mic audio.
#[tauri::command]
pub async fn check_silence_warning(
    recording: State<'_, RecordingState>,
) -> Result<bool, AppError> {
    let Ok(lock) = recording.active.lock() else {
        return Ok(false);
    };
    Ok(lock
        .as_ref()
        .map(|a| a.silence_warning.load(Ordering::Relaxed))
        .unwrap_or(false))
}

/// Attempt a short capture to trigger/check macOS microphone + system audio permissions.
#[tauri::command]
pub async fn check_audio_permissions(app: tauri::AppHandle) -> Result<AudioPermissionStatus, AppError> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::General(e.to_string()))?;
    let recordings_dir = app_data_dir.join("recordings");
    std::fs::create_dir_all(&recordings_dir)?;

    let temp_audio_path = recordings_dir.join(format!(
        "_permission_check_{}.wav",
        std::process::id()
    ));
    let stop_flag = Arc::new(AtomicBool::new(false));
    let paused_flag = Arc::new(AtomicBool::new(false));

    let handles = match start_capture(
        None,
        true,
        &temp_audio_path,
        stop_flag.clone(),
        paused_flag,
    ) {
        Ok(h) => h,
        Err(err) => {
            let _ = std::fs::remove_file(&temp_audio_path);
            return Ok(AudioPermissionStatus {
                microphone: false,
                system_audio: false,
                error: Some(err),
            });
        }
    };

    let system_error = handles.system_audio_error.clone();
    stop_flag.store(true, Ordering::Relaxed);
    drop(handles.mic_stream);
    drop(handles.system_stream);
    let _ = handles.writer_thread.join();
    let _ = std::fs::remove_file(&temp_audio_path);

    Ok(AudioPermissionStatus {
        microphone: true,
        system_audio: system_error.is_none(),
        error: system_error,
    })
}

/// Open macOS System Settings to the Screen & System Audio Recording page.
#[tauri::command]
pub fn open_audio_permission_settings() -> Result<(), AppError> {
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg("x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture")
            .spawn()
            .map_err(|e| AppError::General(format!("Failed to open System Settings: {e}")))?;
    }
    Ok(())
}

/// Open macOS System Settings to the Microphone permission page.
#[tauri::command]
pub fn open_microphone_permission_settings() -> Result<(), AppError> {
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg("x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone")
            .spawn()
            .map_err(|e| AppError::General(format!("Failed to open System Settings: {e}")))?;
    }
    Ok(())
}
