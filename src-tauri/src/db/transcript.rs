use serde::Serialize;

use super::Database;
use crate::error::AppError;

#[derive(Debug, Serialize)]
pub struct TranscriptSegment {
    pub id: i64,
    pub meeting_id: i64,
    pub speaker: Option<String>,
    pub start_ms: i64,
    pub end_ms: i64,
    pub content: String,
}

impl Database {
    /// Batch-insert transcript segments for a meeting.
    pub fn insert_transcript_segments(
        &self,
        meeting_id: i64,
        segments: &[(Option<&str>, i64, i64, &str)], // (speaker, start_ms, end_ms, content)
    ) -> Result<(), AppError> {
        let conn = self.conn.lock().unwrap();
        let tx = conn.unchecked_transaction()?;

        {
            let mut stmt = tx.prepare(
                "INSERT INTO transcript_segments (meeting_id, speaker, start_ms, end_ms, content) \
                 VALUES (?1, ?2, ?3, ?4, ?5)",
            )?;

            for (speaker, start_ms, end_ms, content) in segments {
                stmt.execute(rusqlite::params![meeting_id, speaker, start_ms, end_ms, content])?;
            }
        }

        tx.commit()?;
        Ok(())
    }

    /// Retrieve all transcript segments for a meeting, ordered by start time.
    pub fn get_transcript_segments(
        &self,
        meeting_id: i64,
    ) -> Result<Vec<TranscriptSegment>, AppError> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, meeting_id, speaker, start_ms, end_ms, content \
             FROM transcript_segments \
             WHERE meeting_id = ?1 \
             ORDER BY start_ms ASC",
        )?;

        let segments = stmt
            .query_map(rusqlite::params![meeting_id], |row| {
                Ok(TranscriptSegment {
                    id: row.get(0)?,
                    meeting_id: row.get(1)?,
                    speaker: row.get(2)?,
                    start_ms: row.get(3)?,
                    end_ms: row.get(4)?,
                    content: row.get(5)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;

        Ok(segments)
    }
}
