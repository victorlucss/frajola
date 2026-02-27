use std::path::Path;
use std::sync::Mutex;

use rusqlite::Connection;

use super::migrations::migrations;

pub struct Database {
    pub conn: Mutex<Connection>,
}

impl Database {
    pub fn new(db_path: &Path) -> Result<Self, rusqlite::Error> {
        let mut conn = Connection::open(db_path)?;

        // Enable WAL mode for better concurrent read performance
        conn.pragma_update(None, "journal_mode", "WAL")?;

        // Enforce foreign key constraints
        conn.pragma_update(None, "foreign_keys", "ON")?;

        // Run migrations
        migrations()
            .to_latest(&mut conn)
            .expect("failed to run database migrations");

        Ok(Database {
            conn: Mutex::new(conn),
        })
    }
}
