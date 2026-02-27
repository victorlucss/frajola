# Architecture

## Overview

Frajola is a cross-platform desktop application built with **Tauri v2** (Rust backend + React frontend) that captures audio, generates transcriptions via whisper-rs, and produces AI-powered meeting notes through Ollama (local) or cloud APIs.

```
┌──────────────────────────────────────────────────────────────────┐
│                          Frajola App                             │
├──────────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐    ┌──────────────────┐    ┌────────────┐ │
│  │   UI (React)     │◄──►│  Rust Backend    │◄──►│  SQLite    │ │
│  │   WebView        │    │  (Tauri v2)      │    │ (rusqlite) │ │
│  └──────────────────┘    └────────┬─────────┘    └────────────┘ │
│                                   │                              │
│                     ┌─────────────┼──────────────┐               │
│                     ▼             ▼              ▼               │
│               ┌──────────┐ ┌───────────┐ ┌──────────────┐       │
│               │  Audio   │ │ Whisper   │ │  AI Service  │       │
│               │  (cpal)  │ │(whisper-rs│ │ (Ollama/API) │       │
│               └──────────┘ └───────────┘ └──────────────┘       │
└──────────────────────────────────────────────────────────────────┘
```

## Tech Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| Framework | Tauri v2 | Small binary (~5MB vs ~180MB Electron), native Rust backend, cross-platform |
| Frontend | React 18 + TypeScript | Modern, component-based, type-safe |
| Styling | Tailwind CSS 4 | Fast development, consistent design |
| State | Zustand | Simple, minimal boilerplate |
| i18n | i18next + react-i18next | Industry standard, simple API |
| Database | SQLite (rusqlite) | Local, fast, normalized schema with FTS5 full-text search |
| Audio | cpal | Cross-platform audio I/O in Rust (WASAPI, CoreAudio, ALSA/PulseAudio) |
| Transcription | whisper-rs (local) or OpenAI API | Rust bindings to whisper.cpp, local-first |
| AI Notes | Ollama (local, default) or GPT/Claude (cloud, opt-in) | Privacy-first |
| Packaging | Tauri bundler | Cross-platform (dmg, msi/nsis, AppImage/deb) |
| Secrets | tauri-plugin-store + keyring crate | Secure local storage for API keys |

## Project Structure

```
frajola/
├── src/                          # React frontend
│   ├── components/
│   │   ├── recording/            # Recording controls, mini player
│   │   ├── meetings/             # Meeting list, detail view
│   │   ├── transcript/           # Transcript viewer
│   │   ├── settings/             # Settings panels
│   │   ├── layout/               # Shell, sidebar, header
│   │   └── ui/                   # Shared primitives (button, input, card)
│   ├── hooks/
│   │   ├── useRecording.ts       # Recording state + Tauri commands
│   │   ├── useMeetings.ts        # Meeting CRUD
│   │   ├── useTranscription.ts   # Transcription progress
│   │   └── useSettings.ts        # App settings
│   ├── stores/
│   │   ├── recording.ts          # Zustand: recording state
│   │   ├── meeting.ts            # Zustand: meetings + search
│   │   └── settings.ts           # Zustand: user preferences
│   ├── locales/
│   │   ├── en/
│   │   │   └── translation.json
│   │   └── pt-BR/
│   │       └── translation.json
│   ├── lib/
│   │   ├── tauri.ts              # Typed invoke wrappers
│   │   ├── formatters.ts         # Date, duration, file size helpers
│   │   └── constants.ts          # App-wide constants
│   ├── types/
│   │   ├── meeting.ts            # Meeting, Segment, ActionItem
│   │   ├── recording.ts          # RecordingState, AudioDevice
│   │   ├── settings.ts           # Settings, PrivacyMode
│   │   └── events.ts             # Tauri event payloads
│   ├── App.tsx
│   └── main.tsx
│
├── src-tauri/                    # Rust backend
│   ├── src/
│   │   ├── main.rs               # Tauri entry point
│   │   ├── lib.rs                # Plugin registration
│   │   ├── audio/
│   │   │   ├── capture.rs        # cpal stream setup
│   │   │   ├── devices.rs        # Device enumeration
│   │   │   ├── encoder.rs        # WAV writer (OPUS later)
│   │   │   └── mixer.rs          # Mix system + mic streams
│   │   ├── transcription/
│   │   │   ├── whisper.rs        # whisper-rs local transcription
│   │   │   ├── cloud.rs          # OpenAI Whisper API fallback
│   │   │   └── vad.rs            # Basic voice activity detection
│   │   ├── ai/
│   │   │   ├── ollama.rs         # Ollama HTTP client (reqwest)
│   │   │   ├── openai.rs         # OpenAI API client
│   │   │   ├── anthropic.rs      # Anthropic API client
│   │   │   └── prompts.rs        # Prompt templates (en, pt-BR)
│   │   ├── db/
│   │   │   ├── connection.rs     # rusqlite pool + migrations
│   │   │   ├── migrations.rs     # Schema versioning
│   │   │   ├── meetings.rs       # Meeting CRUD
│   │   │   ├── segments.rs       # Transcript segment ops
│   │   │   ├── search.rs         # FTS5 queries
│   │   │   └── settings.rs       # Key-value settings
│   │   ├── commands/
│   │   │   ├── recording.rs      # start, stop, pause, resume
│   │   │   ├── meetings.rs       # list, get, delete, update
│   │   │   ├── transcription.rs  # transcribe, status
│   │   │   ├── ai.rs             # summarize, check_ollama
│   │   │   ├── export.rs         # markdown, pdf
│   │   │   ├── settings.rs       # get/set settings
│   │   │   └── devices.rs        # list audio devices
│   │   └── export/
│   │       ├── markdown.rs       # Markdown formatter
│   │       └── pdf.rs            # PDF generation
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── capabilities/
│   │   └── default.json          # Tauri v2 permissions
│   └── migrations/
│       └── 001_initial.sql       # Initial schema
│
├── site/                         # Static landing page
│   ├── index.html
│   └── styles.css
│
├── docs/                         # Documentation
│   ├── ARCHITECTURE.md
│   ├── PRD.md
│   ├── TECH_RESEARCH.md
│   └── COMPETITIVE_ANALYSIS.md
│
├── README.md
├── package.json
└── tsconfig.json
```

## Database Schema

Normalized schema using rusqlite with FTS5 for full-text search.

```sql
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
  speaker TEXT,              -- "Speaker 1", "Speaker 2", etc.
  start_ms INTEGER NOT NULL, -- Segment start in milliseconds
  end_ms INTEGER NOT NULL,
  content TEXT NOT NULL
);

CREATE INDEX idx_segments_meeting ON transcript_segments(meeting_id);

-- Action items (normalized from meetings)
CREATE TABLE action_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  meeting_id INTEGER NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  assignee TEXT,              -- Name if mentioned
  completed INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_actions_meeting ON action_items(meeting_id);

-- Speakers (for future speaker memory across meetings)
CREATE TABLE speakers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  voice_signature BLOB       -- For future speaker identification
);

-- AI summaries (separate from meetings for re-generation)
CREATE TABLE summaries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  meeting_id INTEGER NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  summary TEXT NOT NULL,
  key_points TEXT,            -- JSON array
  decisions TEXT,             -- JSON array
  provider TEXT NOT NULL,     -- 'ollama', 'openai', 'anthropic'
  model TEXT NOT NULL,        -- 'llama3.2', 'gpt-4o-mini', etc.
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
  ('privacy_mode', 'local'),          -- 'local', 'hybrid', 'cloud'
  ('transcription_mode', 'local'),    -- 'local' or 'api'
  ('ai_provider', 'ollama'),          -- 'ollama', 'openai', 'anthropic'
  ('ai_model', 'llama3.2'),           -- Default local model
  ('language', 'en'),                 -- UI language
  ('whisper_model', 'base'),          -- Whisper model size
  ('theme', 'system');                -- 'light', 'dark', 'system'

-- Full-text search virtual table
CREATE VIRTUAL TABLE meetings_fts USING fts5(
  title,
  content,                            -- Aggregated transcript text
  content='',                         -- External content mode
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
```

## Data Flow

### 1. Recording Flow

```
User clicks "Start Recording"
         │
         ▼
┌──────────────────┐
│ #[tauri::command] │
│ start_recording   │
└────────┬─────────┘
         │
    ┌────┴─────┐
    ▼          ▼
┌────────┐ ┌────────┐
│ System │ │  Mic   │
│ Audio  │ │ Audio  │
│ (cpal) │ │ (cpal) │
└────┬───┘ └───┬────┘
     │         │
     ▼         ▼
┌──────────────────┐
│     Mixer        │
│ (interleave/mix) │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│   WAV File       │
│ (hound crate)    │
└──────────────────┘
```

Audio format: **WAV** (PCM 16-bit, 16kHz mono for Whisper compatibility). OPUS encoding will be added later as an optimization to reduce storage size.

### 2. Transcription Flow

```
Recording Completed
         │
         ▼
┌──────────────────┐
│  Check Settings  │
│ (local vs cloud) │
└────────┬─────────┘
         │
    ┌────┴─────┐
    ▼          ▼
┌─────────┐ ┌─────────┐
│whisper-rs│ │ OpenAI  │
│ (local) │ │  API    │
└────┬────┘ └────┬────┘
     │           │
     └─────┬─────┘
           ▼
┌──────────────────┐
│   Basic VAD      │
│ (pause-based     │
│  speaker change) │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ transcript_segments│
│   (saved to DB)  │
└──────────────────┘
```

> **Note on speaker detection:** MVP uses basic VAD — silence gaps (>2s) are treated as potential speaker changes. This is naive and will mislabel speakers. True speaker diarization requires ML models (pyannote, etc.) and is planned for v2, likely via a cloud API.

### 3. AI Notes Flow

```
Transcript Ready
         │
         ▼
┌──────────────────┐
│  Build Prompt    │
│ (template + tx)  │
└────────┬─────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌─────────┐ ┌──────────┐
│ Ollama  │ │ Cloud API│
│ (local) │ │(GPT/etc.)│
│ reqwest │ │ reqwest  │
└────┬────┘ └────┬─────┘
     │           │
     └─────┬─────┘
           ▼
┌──────────────────┐
│  Parse Response  │
│  → summaries     │
│  → action_items  │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Save to DB      │
│  + emit event    │
│  to frontend     │
└──────────────────┘
```

Default AI provider is **Ollama** (local). Cloud APIs (OpenAI, Anthropic) are opt-in and require the user to provide their own API keys.

## IPC: Tauri Commands

All backend operations are exposed as `#[tauri::command]` functions invoked from the frontend via `invoke()`.

```rust
// Example: recording commands
#[tauri::command]
async fn start_recording(
    state: State<'_, AppState>,
    device_id: Option<String>,
) -> Result<i64, String> {
    // 1. Create meeting row in DB (status = 'recording')
    // 2. Initialize cpal streams (system + mic)
    // 3. Start writing WAV to disk
    // 4. Return meeting ID
}

#[tauri::command]
async fn stop_recording(
    state: State<'_, AppState>,
    meeting_id: i64,
) -> Result<Meeting, String> {
    // 1. Stop cpal streams
    // 2. Finalize WAV file
    // 3. Update meeting in DB (duration, audio_path)
    // 4. Return meeting
}

// Example: AI summarization
#[tauri::command]
async fn summarize_meeting(
    state: State<'_, AppState>,
    meeting_id: i64,
) -> Result<Summary, String> {
    // 1. Load transcript segments from DB
    // 2. Build prompt from template
    // 3. Send to Ollama (or cloud API based on settings)
    // 4. Parse response → summary + action_items
    // 5. Save to DB
    // 6. Return summary
}
```

Frontend calls these via typed wrappers:

```typescript
// src/lib/tauri.ts
import { invoke } from '@tauri-apps/api/core';

export async function startRecording(deviceId?: string): Promise<number> {
  return invoke('start_recording', { deviceId });
}

export async function stopRecording(meetingId: number): Promise<Meeting> {
  return invoke('stop_recording', { meetingId });
}

export async function summarizeMeeting(meetingId: number): Promise<Summary> {
  return invoke('summarize_meeting', { meetingId });
}
```

## Internationalization (i18n)

### Supported Languages (MVP)
- English (en)
- Portugues Brasileiro (pt-BR)

### Structure
```
src/locales/
├── en/
│   └── translation.json
└── pt-BR/
    └── translation.json
```

AI-generated notes match the meeting language. The prompt template is selected based on the detected or user-selected language.

## Security & Privacy

### Permissions Required

| Platform | Permission | Reason |
|----------|------------|--------|
| macOS | Screen & System Audio Recording | Capture meeting audio via ScreenCaptureKit |
| macOS | Microphone | Capture user's voice |
| Windows | None (WASAPI loopback) | No permission needed for system audio |
| Linux | PulseAudio/PipeWire access | Usually automatic |

### Data Privacy

1. **Local-first by default** — All audio, transcripts, and summaries stored locally
2. **No cloud unless opted in** — User must explicitly enable cloud APIs and provide their own keys
3. **API keys stored securely** — Using `tauri-plugin-store` with OS keychain via `keyring` crate
4. **No telemetry** — No analytics, no tracking, no phone-home
5. **Easy data deletion** — Deleting a meeting removes audio file + all DB rows (CASCADE)

### Tauri v2 Capabilities

Tauri v2 uses a capability-based permission system. Only the minimum required APIs are exposed:

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Default capabilities for Frajola",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "store:allow-get",
    "store:allow-set",
    "dialog:allow-open",
    "dialog:allow-save",
    "fs:allow-app-read",
    "fs:allow-app-write"
  ]
}
```

## Performance Targets

| Metric | Target |
|--------|--------|
| App startup | < 1 second (Tauri is much lighter than Electron) |
| Recording start | < 500ms |
| Memory (idle) | < 30MB |
| Memory (recording) | < 80MB |
| CPU (recording) | < 5% |
| Transcription (local, base model) | ~2x real-time |
| Transcription (API) | 30s for 1hr audio |
| App binary size | ~5-10MB (without Whisper model) |

## Build Phases

| Phase | Weeks | Focus | Risk |
|-------|-------|-------|------|
| 1. Scaffolding | 1-2 | Tauri v2 project + landing page + DB schema + CI | Low |
| 2. Audio Capture | 3-5 | cpal PoC on all 3 platforms | **High** — platform-specific issues |
| 3. UI Shell | 6-7 | React app shell, meeting library, recording controls | Low |
| 4. Transcription | 8-10 | whisper-rs integration, segment storage | Medium |
| 5. AI Summarization | 11-12 | Ollama client, prompt engineering, summary UI | Low |
| 6. Export + Polish | 13-14 | Markdown/PDF export, settings, UX polish | Low |
| 7. i18n + Packaging | 15-18 | pt-BR translations, cross-platform testing, bundling | Medium |

**Total: 14-18 weeks to MVP**

Phase 2 (audio capture) is the highest-risk phase. macOS system audio capture requires ScreenCaptureKit bindings and careful permission handling. If cpal alone is insufficient for system audio on macOS, we may need `screencapturekit-rs` or `objc2` bindings as a platform-specific fallback.

## Privacy Modes

```
┌──────────────────────────────────────────────────────────────┐
│                    Privacy Modes                              │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐     │
│  │ Full Local    │  │   Hybrid      │  │    Cloud      │     │
│  │ (DEFAULT)     │  │               │  │               │     │
│  │               │  │               │  │               │     │
│  │ whisper-rs    │  │ whisper-rs    │  │ Whisper API   │     │
│  │      +        │  │      +        │  │      +        │     │
│  │   Ollama      │  │  GPT/Claude   │  │  GPT/Claude   │     │
│  │               │  │               │  │               │     │
│  │ Data: None    │  │ Data: Text    │  │ Data: Audio   │     │
│  │ leaves device │  │ (transcript)  │  │ + Transcript  │     │
│  └───────────────┘  └───────────────┘  └───────────────┘     │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

**Recommended Local Models (for Ollama):**

| Model | Size | Speed | Quality | Use Case |
|-------|------|-------|---------|----------|
| Llama 3.2 3B | 2GB | Fast | Good | Quick summaries |
| Mistral 7B | 4GB | Medium | Better | Detailed notes |
| Llama 3.1 8B | 5GB | Medium | Great | Best local quality |
| Qwen 2.5 7B | 4GB | Medium | Great | Multilingual (pt-BR) |

## Future Considerations (v2+)

- **Real speaker diarization** — ML-based via cloud API (pyannote or AssemblyAI)
- **Real-time transcription** — Stream audio to Whisper during recording
- **AI Chat** — Query past meetings with RAG over FTS5 index
- **Calendar integration** — Auto-detect meeting start from calendar events
- **OPUS encoding** — Compress WAV to OPUS for ~10x storage savings
- **Cloud sync** — Optional encrypted backup
- **WebGPU Whisper** — In-browser transcription for faster local processing
