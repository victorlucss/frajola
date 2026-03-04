use tauri::Manager;

use crate::error::AppError;

const COMPACT_PILL_SIZE: f64 = 40.0;
const IDLE_PILL_WIDTH: f64 = 100.0;
const RECORDING_PILL_WIDTH: f64 = 140.0;
const PILL_HEIGHT: f64 = 40.0;
const EXPANDED_WIDTH: f64 = 320.0;
const EXPANDED_HEIGHT: f64 = 280.0;

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
