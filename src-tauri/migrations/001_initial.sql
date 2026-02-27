-- Meetings table
CREATE TABLE meetings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  duration_seconds INTEGER,
  audio_path TEXT,
  status TEXT NOT NULL DEFAULT 'recording'
    CHECK (status IN ('recording', 'transcribing', 'summarizing', 'complete', 'failed')),
  language TEXT DEFAULT 'en'
);

-- Transcript segments (normalized from meetings)
CREATE TABLE transcript_segments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  meeting_id INTEGER NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  speaker TEXT,
  start_ms INTEGER NOT NULL,
  end_ms INTEGER NOT NULL,
  content TEXT NOT NULL
);

CREATE INDEX idx_segments_meeting ON transcript_segments(meeting_id);

-- Action items (normalized from meetings)
CREATE TABLE action_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  meeting_id INTEGER NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  assignee TEXT,
  completed INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_actions_meeting ON action_items(meeting_id);

-- Speakers (for future speaker memory across meetings)
CREATE TABLE speakers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  voice_signature BLOB
);

-- AI summaries (separate from meetings for re-generation)
CREATE TABLE summaries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  meeting_id INTEGER NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  summary TEXT NOT NULL,
  key_points TEXT,
  decisions TEXT,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_summaries_meeting ON summaries(meeting_id);

-- Settings (key-value store)
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Default settings: local-first
INSERT INTO settings (key, value) VALUES
  ('privacy_mode', 'local'),
  ('transcription_mode', 'local'),
  ('ai_provider', 'ollama'),
  ('ai_model', 'llama3.2'),
  ('language', 'en'),
  ('whisper_model', 'base'),
  ('theme', 'system');

-- Full-text search virtual table
CREATE VIRTUAL TABLE meetings_fts USING fts5(
  title,
  content,
  content='',
  tokenize='unicode61'
);

-- Triggers to keep FTS index in sync
CREATE TRIGGER meetings_fts_insert AFTER INSERT ON transcript_segments
BEGIN
  INSERT OR REPLACE INTO meetings_fts(rowid, title, content)
  SELECT m.id, COALESCE(m.title, ''),
    GROUP_CONCAT(ts.content, ' ')
  FROM meetings m
  JOIN transcript_segments ts ON ts.meeting_id = m.id
  WHERE m.id = NEW.meeting_id
  GROUP BY m.id;
END;

CREATE TRIGGER meetings_fts_delete AFTER DELETE ON meetings
BEGIN
  DELETE FROM meetings_fts WHERE rowid = OLD.id;
END;
