use rusqlite::OptionalExtension;
use serde::Serialize;

use super::Database;
use crate::error::AppError;

#[derive(Debug, Serialize)]
pub struct SummaryRow {
    pub id: i64,
    pub meeting_id: i64,
    pub summary: String,
    pub key_points: String, // JSON array
    pub decisions: String,  // JSON array
    pub provider: String,
    pub model: String,
    pub created_at: String,
}

#[derive(Debug, Serialize)]
pub struct ActionItemRow {
    pub id: i64,
    pub meeting_id: i64,
    pub description: String,
    pub assignee: Option<String>,
    pub completed: bool,
}

impl Database {
    pub fn insert_summary(
        &self,
        meeting_id: i64,
        summary: &str,
        key_points: &str,
        decisions: &str,
        provider: &str,
        model: &str,
    ) -> Result<(), AppError> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO summaries (meeting_id, summary, key_points, decisions, provider, model) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            rusqlite::params![meeting_id, summary, key_points, decisions, provider, model],
        )?;
        Ok(())
    }

    pub fn get_summary(&self, meeting_id: i64) -> Result<Option<SummaryRow>, AppError> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, meeting_id, summary, key_points, decisions, provider, model, created_at \
             FROM summaries WHERE meeting_id = ?1 \
             ORDER BY created_at DESC LIMIT 1",
        )?;

        let row = stmt
            .query_row(rusqlite::params![meeting_id], |row| {
                Ok(SummaryRow {
                    id: row.get(0)?,
                    meeting_id: row.get(1)?,
                    summary: row.get(2)?,
                    key_points: row.get(3)?,
                    decisions: row.get(4)?,
                    provider: row.get(5)?,
                    model: row.get(6)?,
                    created_at: row.get(7)?,
                })
            })
            .optional()?;

        Ok(row)
    }

    pub fn insert_action_items(
        &self,
        meeting_id: i64,
        items: &[(String, Option<String>)], // (description, assignee)
    ) -> Result<(), AppError> {
        let conn = self.conn.lock().unwrap();
        let tx = conn.unchecked_transaction()?;

        {
            let mut stmt = tx.prepare(
                "INSERT INTO action_items (meeting_id, description, assignee) \
                 VALUES (?1, ?2, ?3)",
            )?;

            for (description, assignee) in items {
                stmt.execute(rusqlite::params![meeting_id, description, assignee])?;
            }
        }

        tx.commit()?;
        Ok(())
    }

    pub fn get_action_items(&self, meeting_id: i64) -> Result<Vec<ActionItemRow>, AppError> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, meeting_id, description, assignee, completed \
             FROM action_items WHERE meeting_id = ?1 \
             ORDER BY id ASC",
        )?;

        let items = stmt
            .query_map(rusqlite::params![meeting_id], |row| {
                Ok(ActionItemRow {
                    id: row.get(0)?,
                    meeting_id: row.get(1)?,
                    description: row.get(2)?,
                    assignee: row.get(3)?,
                    completed: row.get::<_, i64>(4)? != 0,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;

        Ok(items)
    }
}
