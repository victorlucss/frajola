use serde::Serialize;
use tauri::State;

use crate::db::meetings::Meeting;
use crate::db::summaries::ActionItemRow;
use crate::db::transcript::TranscriptSegment;
use crate::db::Database;
use crate::error::AppError;

#[derive(Debug, Serialize)]
pub struct SummaryResponse {
    pub overview: String,
    pub key_points: Vec<String>,
    pub decisions: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct MeetingDetailResponse {
    pub meeting: Meeting,
    pub transcript: Vec<TranscriptSegment>,
    pub summary: Option<SummaryResponse>,
    pub action_items: Vec<ActionItemRow>,
}

#[tauri::command]
pub fn list_meetings(db: State<'_, Database>) -> Result<Vec<Meeting>, AppError> {
    db.list_meetings()
}

#[tauri::command]
pub fn get_meeting(db: State<'_, Database>, id: i64) -> Result<Option<Meeting>, AppError> {
    db.get_meeting(id)
}

#[tauri::command]
pub fn get_meeting_detail(
    db: State<'_, Database>,
    id: i64,
) -> Result<MeetingDetailResponse, AppError> {
    let meeting = db
        .get_meeting(id)?
        .ok_or_else(|| AppError::General("Meeting not found".into()))?;
    let transcript = db.get_transcript_segments(id)?;
    let action_items = db.get_action_items(id)?;

    let summary = db.get_summary(id)?.map(|row| {
        let key_points: Vec<String> =
            serde_json::from_str(&row.key_points).unwrap_or_default();
        let decisions: Vec<String> =
            serde_json::from_str(&row.decisions).unwrap_or_default();
        SummaryResponse {
            overview: row.summary,
            key_points,
            decisions,
        }
    });

    Ok(MeetingDetailResponse {
        meeting,
        transcript,
        summary,
        action_items,
    })
}

#[tauri::command]
pub fn delete_meeting(db: State<'_, Database>, id: i64) -> Result<(), AppError> {
    db.delete_meeting(id)
}
