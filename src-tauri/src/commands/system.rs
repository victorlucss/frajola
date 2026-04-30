use crate::error::AppError;
use crate::system::memory;

/// Returns the current process RSS in bytes. UI polls this periodically
/// to render the title-bar memory pill.
#[tauri::command]
pub async fn get_process_memory() -> Result<u64, AppError> {
    tauri::async_runtime::spawn_blocking(memory::current_rss_bytes)
        .await
        .map_err(|e| AppError::General(format!("memory probe failed: {e}")))
}
