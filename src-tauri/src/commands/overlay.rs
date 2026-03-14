use std::sync::Mutex;
use tauri::Manager;

use crate::error::AppError;

const COMPACT_PILL_SIZE: f64 = 48.0;
const IDLE_PILL_WIDTH: f64 = 118.0;
const RECORDING_PILL_WIDTH: f64 = 160.0;
const DICTATION_PILL_WIDTH: f64 = 110.0;
const DICTATION_PILL_HEIGHT: f64 = 48.0;
const PILL_HEIGHT: f64 = 48.0;
const EXPANDED_WIDTH: f64 = 213.0;
const EXPANDED_HEIGHT: f64 = 187.0;

/// Saved pill position before dictation moves it
static SAVED_PILL_POS: Mutex<Option<(f64, f64)>> = Mutex::new(None);

fn set_overlay_size(window: &tauri::WebviewWindow, width: f64, height: f64) -> Result<(), AppError> {
    window
        .set_size(tauri::Size::Logical(tauri::LogicalSize { width, height }))
        .map_err(|e| AppError::General(e.to_string()))
}

#[tauri::command]
pub async fn show_overlay(app: tauri::AppHandle) -> Result<(), AppError> {
    let window = app
        .get_webview_window("overlay")
        .ok_or_else(|| AppError::General("Overlay window not found".into()))?;
    set_overlay_size(&window, IDLE_PILL_WIDTH, PILL_HEIGHT)?;
    window
        .show()
        .map_err(|e| AppError::General(e.to_string()))?;
    Ok(())
}

#[tauri::command]
pub async fn hide_overlay(app: tauri::AppHandle) -> Result<(), AppError> {
    let window = app
        .get_webview_window("overlay")
        .ok_or_else(|| AppError::General("Overlay window not found".into()))?;
    window
        .hide()
        .map_err(|e| AppError::General(e.to_string()))?;
    Ok(())
}

#[tauri::command]
pub async fn expand_overlay(app: tauri::AppHandle) -> Result<(), AppError> {
    let window = app
        .get_webview_window("overlay")
        .ok_or_else(|| AppError::General("Overlay window not found".into()))?;
    set_overlay_size(&window, EXPANDED_WIDTH, EXPANDED_HEIGHT)?;
    Ok(())
}

#[tauri::command]
pub async fn collapse_overlay(app: tauri::AppHandle) -> Result<(), AppError> {
    let window = app
        .get_webview_window("overlay")
        .ok_or_else(|| AppError::General("Overlay window not found".into()))?;
    set_overlay_size(&window, IDLE_PILL_WIDTH, PILL_HEIGHT)?;
    Ok(())
}

#[tauri::command]
pub async fn set_overlay_pill_width(
    app: tauri::AppHandle,
    recording: bool,
) -> Result<(), AppError> {
    let window = app
        .get_webview_window("overlay")
        .ok_or_else(|| AppError::General("Overlay window not found".into()))?;
    let width = if recording {
        RECORDING_PILL_WIDTH
    } else {
        IDLE_PILL_WIDTH
    };
    set_overlay_size(&window, width, PILL_HEIGHT)?;
    Ok(())
}

#[tauri::command]
pub async fn compact_overlay(app: tauri::AppHandle) -> Result<(), AppError> {
    let window = app
        .get_webview_window("overlay")
        .ok_or_else(|| AppError::General("Overlay window not found".into()))?;
    set_overlay_size(&window, COMPACT_PILL_SIZE, COMPACT_PILL_SIZE)?;
    Ok(())
}

#[tauri::command]
pub async fn show_dictation_overlay(app: tauri::AppHandle) -> Result<(), AppError> {
    let window = app
        .get_webview_window("overlay")
        .ok_or_else(|| AppError::General("Overlay window not found".into()))?;

    // Save current pill position before moving
    if let Ok(pos) = window.outer_position() {
        let scale = window
            .current_monitor()
            .ok()
            .flatten()
            .map(|m| m.scale_factor())
            .unwrap_or(1.0);
        if let Ok(mut saved) = SAVED_PILL_POS.lock() {
            *saved = Some((pos.x as f64 / scale, pos.y as f64 / scale));
        }
    }

    set_overlay_size(&window, DICTATION_PILL_WIDTH, DICTATION_PILL_HEIGHT)?;

    // Read position preference (default: bottom)
    let position = app
        .try_state::<crate::db::Database>()
        .and_then(|db| db.get_setting("dictation_overlay_position").ok().flatten())
        .unwrap_or_else(|| "bottom".to_string());

    // Center horizontally on the current monitor
    if let Ok(Some(monitor)) = window.current_monitor() {
        let screen_size = monitor.size();
        let screen_pos = monitor.position();
        let scale = monitor.scale_factor();

        let screen_w = screen_size.width as f64 / scale;
        let screen_h = screen_size.height as f64 / scale;
        let screen_x = screen_pos.x as f64 / scale;
        let screen_y = screen_pos.y as f64 / scale;

        let x = screen_x + (screen_w - DICTATION_PILL_WIDTH) / 2.0;
        let y = if position == "top" {
            screen_y + 12.0
        } else {
            screen_y + screen_h - DICTATION_PILL_HEIGHT - 12.0
        };

        let _ = window.set_position(tauri::Position::Logical(tauri::LogicalPosition { x, y }));
    }

    window
        .show()
        .map_err(|e| AppError::General(e.to_string()))?;
    Ok(())
}

#[tauri::command]
pub async fn hide_dictation_overlay(app: tauri::AppHandle) -> Result<(), AppError> {
    let window = app
        .get_webview_window("overlay")
        .ok_or_else(|| AppError::General("Overlay window not found".into()))?;

    // Restore saved pill position
    let saved = SAVED_PILL_POS.lock().ok().and_then(|mut s| s.take());
    if let Some((x, y)) = saved {
        let _ = window.set_position(tauri::Position::Logical(tauri::LogicalPosition { x, y }));
    }

    set_overlay_size(&window, COMPACT_PILL_SIZE, COMPACT_PILL_SIZE)?;
    Ok(())
}
