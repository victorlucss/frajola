use serde::Serialize;

use super::Database;
use crate::error::AppError;

#[derive(Debug, Serialize)]
pub struct Meeting {
    pub id: i64,
    pub title: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub duration_seconds: Option<i64>,
    pub audio_path: Option<String>,
    pub status: String,
    pub language: Option<String>,
}

impl Database {
    pub fn list_meetings(&self) -> Result<Vec<Meeting>, AppError> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, title, created_at, updated_at, duration_seconds, audio_path, status, language
             FROM meetings
             ORDER BY created_at DESC",
        )?;
        let meetings = stmt
            .query_map([], |row| {
                Ok(Meeting {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    created_at: row.get(2)?,
                    updated_at: row.get(3)?,
                    duration_seconds: row.get(4)?,
                    audio_path: row.get(5)?,
                    status: row.get(6)?,
                    language: row.get(7)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(meetings)
    }
}
