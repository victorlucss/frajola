use std::time::{SystemTime, UNIX_EPOCH};

use rusqlite::OptionalExtension;
use serde::Serialize;

use super::Database;
use crate::error::AppError;

const FOOD_NAMES: &[&str] = &[
    "Ramen", "Tacos", "Paella", "Sushi", "Croissant", "Pho", "Biryani", "Feijoada",
    "Kimchi", "Curry", "Pad Thai", "Empanada", "Tiramisu", "Baklava", "Ceviche",
    "Goulash", "Pierogi", "Shakshuka", "Arepas", "Dim Sum", "Moussaka", "Poutine",
    "Tagine", "Bibimbap", "Churros", "Hummus", "Borscht", "Gyoza", "Bruschetta", "Rendang",
];

fn generate_food_title() -> String {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .subsec_nanos() as usize;
    FOOD_NAMES[nanos % FOOD_NAMES.len()].to_string()
}

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

fn row_to_meeting(row: &rusqlite::Row) -> rusqlite::Result<Meeting> {
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
}

const SELECT_COLS: &str =
    "id, title, created_at, updated_at, duration_seconds, audio_path, status, language";

impl Database {
    pub fn list_meetings(&self) -> Result<Vec<Meeting>, AppError> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(&format!(
            "SELECT {SELECT_COLS} FROM meetings ORDER BY created_at DESC"
        ))?;
        let meetings = stmt
            .query_map([], |row| row_to_meeting(row))?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(meetings)
    }

    pub fn get_meeting(&self, id: i64) -> Result<Option<Meeting>, AppError> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(&format!(
            "SELECT {SELECT_COLS} FROM meetings WHERE id = ?1"
        ))?;
        let meeting = stmt
            .query_row(rusqlite::params![id], |row| row_to_meeting(row))
            .optional()?;
        Ok(meeting)
    }

    pub fn create_meeting(&self) -> Result<Meeting, AppError> {
        let conn = self.conn.lock().unwrap();
        let title = generate_food_title();
        conn.execute(
            "INSERT INTO meetings (title, status, language) VALUES (?1, 'recording', COALESCE((SELECT value FROM settings WHERE key = 'language'), 'en'))",
            rusqlite::params![title],
        )?;
        let id = conn.last_insert_rowid();
        let mut stmt = conn.prepare(&format!(
            "SELECT {SELECT_COLS} FROM meetings WHERE id = ?1"
        ))?;
        let meeting = stmt.query_row(rusqlite::params![id], |row| row_to_meeting(row))?;
        Ok(meeting)
    }

    pub fn update_meeting_on_stop(
        &self,
        id: i64,
        audio_path: &str,
        duration_seconds: i64,
    ) -> Result<(), AppError> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE meetings SET audio_path = ?1, duration_seconds = ?2, status = 'complete', updated_at = datetime('now') WHERE id = ?3",
            rusqlite::params![audio_path, duration_seconds, id],
        )?;
        Ok(())
    }

    pub fn update_meeting_status(&self, id: i64, status: &str) -> Result<(), AppError> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE meetings SET status = ?1, updated_at = datetime('now') WHERE id = ?2",
            rusqlite::params![status, id],
        )?;
        Ok(())
    }

    pub fn update_meeting_title(&self, id: i64, title: &str) -> Result<(), AppError> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE meetings SET title = ?1, updated_at = datetime('now') WHERE id = ?2",
            rusqlite::params![title, id],
        )?;
        Ok(())
    }

    pub fn delete_meeting(&self, id: i64) -> Result<(), AppError> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM meetings WHERE id = ?1", rusqlite::params![id])?;
        Ok(())
    }
}
