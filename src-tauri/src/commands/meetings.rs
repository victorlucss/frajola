use tauri::State;

use crate::db::Database;
use crate::db::meetings::Meeting;
use crate::error::AppError;

#[tauri::command]
pub fn list_meetings(db: State<'_, Database>) -> Result<Vec<Meeting>, AppError> {
    db.list_meetings()
}
