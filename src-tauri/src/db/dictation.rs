use serde::Serialize;

use super::Database;
use crate::dictation::processor::{DictationSnippet, DictationVoiceCommand};
use crate::error::AppError;

// ─── Dictionary ──────────────────────────────────────────

impl Database {
    pub fn get_dictation_dictionary(&self) -> Result<Vec<String>, AppError> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT entry FROM dictation_dictionary ORDER BY entry")?;
        let entries = stmt
            .query_map([], |row| row.get(0))?
            .collect::<Result<Vec<String>, _>>()?;
        Ok(entries)
    }

    pub fn add_dictation_dictionary_entry(&self, entry: &str) -> Result<(), AppError> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT OR IGNORE INTO dictation_dictionary (entry) VALUES (?1)",
            [entry.trim()],
        )?;
        Ok(())
    }

    pub fn remove_dictation_dictionary_entry(&self, entry: &str) -> Result<(), AppError> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "DELETE FROM dictation_dictionary WHERE entry = ?1",
            [entry],
        )?;
        Ok(())
    }
}

// ─── Snippets ────────────────────────────────────────────

impl Database {
    pub fn get_dictation_snippets(&self) -> Result<Vec<DictationSnippet>, AppError> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT trigger_text, expansion FROM dictation_snippets ORDER BY trigger_text",
        )?;
        let snippets = stmt
            .query_map([], |row| {
                Ok(DictationSnippet {
                    trigger: row.get(0)?,
                    expansion: row.get(1)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(snippets)
    }

    pub fn add_dictation_snippet(&self, trigger: &str, expansion: &str) -> Result<(), AppError> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT OR REPLACE INTO dictation_snippets (trigger_text, expansion) VALUES (?1, ?2)",
            [trigger.trim(), expansion],
        )?;
        Ok(())
    }

    pub fn remove_dictation_snippet(&self, trigger: &str) -> Result<(), AppError> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "DELETE FROM dictation_snippets WHERE trigger_text = ?1",
            [trigger],
        )?;
        Ok(())
    }
}

// ─── Voice Commands ──────────────────────────────────────

impl Database {
    pub fn get_dictation_voice_commands(&self) -> Result<Vec<DictationVoiceCommand>, AppError> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT trigger_text, key_combo FROM dictation_voice_commands ORDER BY trigger_text",
        )?;
        let commands = stmt
            .query_map([], |row| {
                Ok(DictationVoiceCommand {
                    trigger: row.get(0)?,
                    key_combo: row.get(1)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(commands)
    }

    pub fn add_dictation_voice_command(
        &self,
        trigger: &str,
        key_combo: &str,
    ) -> Result<(), AppError> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT OR REPLACE INTO dictation_voice_commands (trigger_text, key_combo) VALUES (?1, ?2)",
            [trigger.trim(), key_combo],
        )?;
        Ok(())
    }

    pub fn remove_dictation_voice_command(&self, trigger: &str) -> Result<(), AppError> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "DELETE FROM dictation_voice_commands WHERE trigger_text = ?1",
            [trigger],
        )?;
        Ok(())
    }
}

// ─── History ─────────────────────────────────────────────

#[derive(Debug, Clone, Serialize)]
pub struct DictationHistoryEntry {
    pub id: i64,
    pub raw_text: String,
    pub processed_text: String,
    pub target_app: Option<String>,
    pub engine: Option<String>,
    pub created_at: String,
}

impl Database {
    pub fn add_dictation_history(
        &self,
        raw_text: &str,
        processed_text: &str,
        target_app: Option<&str>,
        engine: Option<&str>,
    ) -> Result<(), AppError> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO dictation_history (raw_text, processed_text, target_app, engine) VALUES (?1, ?2, ?3, ?4)",
            rusqlite::params![raw_text, processed_text, target_app, engine],
        )?;

        // Keep only the latest 500 entries
        conn.execute(
            "DELETE FROM dictation_history WHERE id NOT IN (SELECT id FROM dictation_history ORDER BY created_at DESC LIMIT 500)",
            [],
        )?;
        Ok(())
    }

    pub fn get_dictation_history(
        &self,
        limit: i64,
    ) -> Result<Vec<DictationHistoryEntry>, AppError> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, raw_text, processed_text, target_app, engine, created_at
             FROM dictation_history ORDER BY created_at DESC LIMIT ?1",
        )?;
        let entries = stmt
            .query_map([limit], |row| {
                Ok(DictationHistoryEntry {
                    id: row.get(0)?,
                    raw_text: row.get(1)?,
                    processed_text: row.get(2)?,
                    target_app: row.get(3)?,
                    engine: row.get(4)?,
                    created_at: row.get(5)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(entries)
    }

    pub fn clear_dictation_history(&self) -> Result<(), AppError> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM dictation_history", [])?;
        Ok(())
    }
}

// ─── Tests ───────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::Database;
    use std::path::Path;
    use tempfile::NamedTempFile;

    fn test_db() -> Database {
        let tmp = NamedTempFile::new().unwrap();
        Database::new(tmp.path()).unwrap()
    }

    #[test]
    fn test_dictionary_crud() {
        let db = test_db();

        // Initially empty
        let entries = db.get_dictation_dictionary().unwrap();
        assert!(entries.is_empty());

        // Add entries
        db.add_dictation_dictionary_entry("Frajola").unwrap();
        db.add_dictation_dictionary_entry("Tauri").unwrap();

        let entries = db.get_dictation_dictionary().unwrap();
        assert_eq!(entries.len(), 2);
        assert!(entries.contains(&"Frajola".to_string()));

        // Duplicate insert is ignored
        db.add_dictation_dictionary_entry("Frajola").unwrap();
        let entries = db.get_dictation_dictionary().unwrap();
        assert_eq!(entries.len(), 2);

        // Remove
        db.remove_dictation_dictionary_entry("Frajola").unwrap();
        let entries = db.get_dictation_dictionary().unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0], "Tauri");
    }

    #[test]
    fn test_snippets_crud() {
        let db = test_db();

        db.add_dictation_snippet("my email", "victor@example.com")
            .unwrap();
        db.add_dictation_snippet("greeting", "Hello! How are you?")
            .unwrap();

        let snippets = db.get_dictation_snippets().unwrap();
        assert_eq!(snippets.len(), 2);
        assert_eq!(snippets[0].trigger, "greeting");
        assert_eq!(snippets[0].expansion, "Hello! How are you?");

        // Update via upsert
        db.add_dictation_snippet("my email", "new@example.com")
            .unwrap();
        let snippets = db.get_dictation_snippets().unwrap();
        assert_eq!(snippets.len(), 2);
        let email = snippets.iter().find(|s| s.trigger == "my email").unwrap();
        assert_eq!(email.expansion, "new@example.com");

        // Remove
        db.remove_dictation_snippet("greeting").unwrap();
        let snippets = db.get_dictation_snippets().unwrap();
        assert_eq!(snippets.len(), 1);
    }

    #[test]
    fn test_voice_commands_crud() {
        let db = test_db();

        db.add_dictation_voice_command("screenshot", "cmd+shift+3")
            .unwrap();
        let commands = db.get_dictation_voice_commands().unwrap();
        assert_eq!(commands.len(), 1);
        assert_eq!(commands[0].trigger, "screenshot");
        assert_eq!(commands[0].key_combo, "cmd+shift+3");

        db.remove_dictation_voice_command("screenshot").unwrap();
        let commands = db.get_dictation_voice_commands().unwrap();
        assert!(commands.is_empty());
    }

    #[test]
    fn test_history_crud() {
        let db = test_db();

        db.add_dictation_history("hello world", "Hello, world.", Some("Slack"), Some("whisper"))
            .unwrap();
        db.add_dictation_history("test", "Test.", None, Some("apple"))
            .unwrap();

        let history = db.get_dictation_history(10).unwrap();
        assert_eq!(history.len(), 2);
        // Most recent first
        assert_eq!(history[0].raw_text, "test");
        assert_eq!(history[1].raw_text, "hello world");
        assert_eq!(history[1].target_app, Some("Slack".to_string()));

        // Clear
        db.clear_dictation_history().unwrap();
        let history = db.get_dictation_history(10).unwrap();
        assert!(history.is_empty());
    }

    #[test]
    fn test_dictation_default_settings() {
        let db = test_db();

        let enabled = db.get_setting("dictation_enabled").unwrap();
        assert_eq!(enabled, Some("1".to_string()));

        let mode = db.get_setting("dictation_hotkey_mode").unwrap();
        assert_eq!(mode, Some("toggle".to_string()));

        let engine = db.get_setting("dictation_stt_engine").unwrap();
        assert_eq!(engine, Some("whisper".to_string()));
    }
}
