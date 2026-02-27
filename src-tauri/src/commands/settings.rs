use tauri::State;

use crate::db::Database;
use crate::db::settings::Setting;
use crate::error::AppError;

#[tauri::command]
pub fn get_settings(db: State<'_, Database>) -> Result<Vec<Setting>, AppError> {
    db.get_all_settings()
}

#[tauri::command]
pub fn get_setting(db: State<'_, Database>, key: String) -> Result<Option<String>, AppError> {
    db.get_setting(&key)
}

#[tauri::command]
pub fn set_setting(db: State<'_, Database>, key: String, value: String) -> Result<(), AppError> {
    db.set_setting(&key, &value)
}
