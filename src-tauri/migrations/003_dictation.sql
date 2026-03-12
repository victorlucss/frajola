-- Dictation custom dictionary entries (proper nouns, acronyms, jargon)
CREATE TABLE dictation_dictionary (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry TEXT NOT NULL UNIQUE
);

-- Dictation snippets (trigger phrase → text expansion)
CREATE TABLE dictation_snippets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trigger_text TEXT NOT NULL UNIQUE,
  expansion TEXT NOT NULL
);

-- Dictation voice commands (trigger phrase → keyboard shortcut)
CREATE TABLE dictation_voice_commands (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trigger_text TEXT NOT NULL UNIQUE,
  key_combo TEXT NOT NULL
);

-- Dictation history log
CREATE TABLE dictation_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  raw_text TEXT NOT NULL,
  processed_text TEXT NOT NULL,
  target_app TEXT,
  engine TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_dictation_history_created ON dictation_history(created_at);

-- Default dictation settings
INSERT OR IGNORE INTO settings (key, value) VALUES
  ('dictation_enabled', '1'),
  ('dictation_hotkey_mode', 'toggle'),
  ('dictation_stt_engine', 'whisper'),
  ('dictation_language', 'en'),
  ('dictation_llm_enabled', '0'),
  ('dictation_llm_correction_level', '3'),
  ('dictation_llm_provider', 'ollama'),
  ('dictation_llm_model', 'llama3.2'),
  ('dictation_llm_api_key', ''),
  ('dictation_llm_endpoint', ''),
  ('dictation_flow_mode', '0'),
  ('dictation_code_mode', '0');
