use tauri::State;

use crate::db::Database;
use crate::db::settings::Setting;
use crate::error::AppError;

/// Setting keys whose values are secrets and must NEVER be returned to the
/// webview. Reads on these keys always return an empty string; backend
/// commands that need the real value (LLM HTTP calls) read from the DB
/// directly via `Database::get_setting`.
const SECRET_KEYS: &[&str] = &[
    "dictation_llm_api_key",
    "openai_api_key",
    "anthropic_api_key",
];

fn is_secret(key: &str) -> bool {
    SECRET_KEYS.contains(&key)
}

#[tauri::command]
pub fn get_settings(db: State<'_, Database>) -> Result<Vec<Setting>, AppError> {
    let mut all = db.get_all_settings()?;
    for s in all.iter_mut() {
        if is_secret(&s.key) {
            s.value = String::new();
        }
    }
    Ok(all)
}

#[tauri::command]
pub fn get_setting(db: State<'_, Database>, key: String) -> Result<Option<String>, AppError> {
    if is_secret(&key) {
        return Ok(Some(String::new()));
    }
    db.get_setting(&key)
}

/// Companion command: tell the UI whether a secret-typed setting has any
/// value persisted, without revealing the value. Returns false for
/// non-secret keys (UI can read those directly).
#[tauri::command]
pub fn is_setting_configured(db: State<'_, Database>, key: String) -> Result<bool, AppError> {
    if !is_secret(&key) {
        return Ok(false);
    }
    Ok(db
        .get_setting(&key)?
        .map(|v| !v.is_empty())
        .unwrap_or(false))
}

#[tauri::command]
pub fn set_setting(db: State<'_, Database>, key: String, value: String) -> Result<(), AppError> {
    // For secrets, an empty write is a no-op so the UI can render an empty
    // input without nuking the persisted key. Use clear_setting() to remove.
    if is_secret(&key) && value.is_empty() {
        return Ok(());
    }
    db.set_setting(&key, &value)
}

/// Explicitly remove a secret value (or any setting). Distinct from
/// `set_setting("", "")` so accidental empty writes don't clear keys.
#[tauri::command]
pub fn clear_setting(db: State<'_, Database>, key: String) -> Result<(), AppError> {
    db.set_setting(&key, "")
}
