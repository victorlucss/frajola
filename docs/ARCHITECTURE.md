# Architecture

## Overview

Frajola is an Electron-based desktop application that captures audio, generates transcriptions, and produces AI-powered meeting notes.

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frajola App                               │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────┐ │
│  │   UI (React)    │◄──►│   Main Process   │◄──►│   SQLite    │ │
│  │   Renderer      │    │   (Electron)     │    │   Database  │ │
│  └─────────────────┘    └────────┬─────────┘    └─────────────┘ │
│                                  │                               │
│                    ┌─────────────┼─────────────┐                │
│                    ▼             ▼             ▼                │
│              ┌──────────┐ ┌──────────┐ ┌──────────────┐        │
│              │  Audio   │ │ Whisper  │ │  AI Service  │        │
│              │ Capture  │ │  (Local) │ │ (GPT/Claude) │        │
│              └──────────┘ └──────────┘ └──────────────┘        │
└─────────────────────────────────────────────────────────────────┘
```

## Tech Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| Framework | Electron 33+ | Cross-platform, mature ecosystem, native audio APIs |
| Frontend | React 18 + TypeScript | Modern, component-based, type-safe |
| Styling | Tailwind CSS | Fast development, consistent design |
| State | Zustand | Simple, minimal boilerplate |
| i18n | i18next + react-i18next | Industry standard, simple API |
| Database | SQLite (better-sqlite3) | Local, fast, no server needed |
| Audio | Native APIs + electron-audio-loopback | System audio capture |
| Transcription | Whisper.cpp (local) or OpenAI API | Flexibility: offline vs cloud |
| AI Notes | Ollama (local) or GPT/Claude (cloud) | Privacy options |
| Build | electron-builder | Cross-platform packaging |

## Project Structure

```
frajola/
├── src/
│   ├── main/                    # Electron main process
│   │   ├── index.ts             # Entry point
│   │   ├── audio/               # Audio capture modules
│   │   │   ├── recorder.ts      # Recording orchestration
│   │   │   ├── system-audio.ts  # System audio loopback
│   │   │   ├── microphone.ts    # Mic capture
│   │   │   └── mixer.ts         # Audio mixing
│   │   ├── transcription/       # Transcription services
│   │   │   ├── whisper-local.ts # Whisper.cpp wrapper
│   │   │   ├── whisper-api.ts   # OpenAI Whisper API
│   │   │   └── diarization.ts   # Speaker identification
│   │   ├── ai/                  # AI note generation
│   │   │   ├── summarizer.ts    # Meeting summarization
│   │   │   └── prompts.ts       # Prompt templates
│   │   ├── database/            # SQLite operations
│   │   │   ├── index.ts         # Database connection
│   │   │   ├── schema.ts        # Table definitions
│   │   │   └── migrations/      # Schema migrations
│   │   ├── ipc/                 # IPC handlers
│   │   │   └── handlers.ts      # Main-to-renderer IPC
│   │   └── utils/               # Shared utilities
│   │
│   ├── renderer/                # React UI
│   │   ├── App.tsx              # Root component
│   │   ├── components/          # UI components
│   │   │   ├── RecordingControls.tsx
│   │   │   ├── MeetingList.tsx
│   │   │   ├── MeetingDetails.tsx
│   │   │   ├── Transcript.tsx
│   │   │   └── Settings.tsx
│   │   ├── hooks/               # Custom React hooks
│   │   ├── stores/              # Zustand stores
│   │   └── styles/              # Tailwind config
│   │
│   ├── shared/                  # Shared types/constants
│   │   ├── types.ts             # TypeScript interfaces
│   │   └── constants.ts         # App constants
│   │
│   └── preload/                 # Electron preload scripts
│       └── index.ts             # Expose APIs to renderer
│
├── resources/                   # App resources
│   ├── icons/                   # App icons
│   └── whisper/                 # Whisper model files
│
├── docs/                        # Documentation
├── electron-builder.yml         # Build configuration
├── package.json
└── tsconfig.json
```

## Data Flow

### 1. Recording Flow

```
User clicks "Start Recording"
         │
         ▼
┌─────────────────┐
│  Main Process   │
│  startRecording │
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌────────┐ ┌────────┐
│ System │ │  Mic   │
│ Audio  │ │ Audio  │
└────┬───┘ └───┬────┘
     │         │
     ▼         ▼
┌─────────────────┐
│    Mixer        │
│ (combine audio) │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   WAV File      │
│ (local storage) │
└─────────────────┘
```

### 2. Transcription Flow

```
Recording Completed
         │
         ▼
┌─────────────────┐
│  Check Settings │
│ (Local vs API)  │
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌────────┐ ┌────────┐
│ Whisper│ │ OpenAI │
│ Local  │ │  API   │
└────┬───┘ └───┬────┘
     │         │
     └────┬────┘
          ▼
┌─────────────────┐
│   Diarization   │
│ (speaker ID)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Transcript    │
│   (with times)  │
└─────────────────┘
```

### 3. AI Notes Flow

```
Transcript Ready
         │
         ▼
┌─────────────────┐
│  Build Prompt   │
│ (template + tx) │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  GPT/Claude API │
│  (summarize)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Parse Response │
│  (structured)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Save to DB     │
│  + Display      │
└─────────────────┘
```

## Internationalization (i18n)

### Supported Languages (MVP)
- 🇺🇸 English (en)
- 🇧🇷 Português Brasileiro (pt-BR)

### Structure
```
src/
└── renderer/
    └── locales/
        ├── en/
        │   └── translation.json
        └── pt-BR/
            └── translation.json
```

### Implementation
```typescript
// i18n setup
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: require('./locales/en/translation.json') },
    'pt-BR': { translation: require('./locales/pt-BR/translation.json') },
  },
  lng: navigator.language, // Auto-detect
  fallbackLng: 'en',
});

// Usage in components
function RecordButton() {
  const { t } = useTranslation();
  return <button>{t('recording.start')}</button>;
}
```

### AI Notes Language

AI-generated notes should match the meeting language:

```typescript
const PROMPTS = {
  en: `You are a meeting notes assistant. Summarize in English...`,
  'pt-BR': `Você é um assistente de notas de reunião. Resuma em português brasileiro...`,
};

async function summarize(transcript: string, language: string) {
  const prompt = PROMPTS[language] || PROMPTS.en;
  // ...
}
```

## Database Schema

```sql
-- Meetings table
CREATE TABLE meetings (
  id TEXT PRIMARY KEY,
  title TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  duration_seconds INTEGER,
  audio_path TEXT,
  status TEXT DEFAULT 'recording', -- recording, transcribing, processing, complete
  transcript TEXT,
  summary TEXT,
  action_items TEXT, -- JSON array
  key_points TEXT,   -- JSON array
  decisions TEXT     -- JSON array
);

-- Settings table
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

-- Default settings
INSERT INTO settings (key, value) VALUES
  ('transcription_mode', 'local'),    -- 'local' or 'api'
  ('ai_provider', 'openai'),          -- 'openai' or 'anthropic'
  ('language', 'en'),                 -- default language
  ('auto_start', 'false'),            -- auto-detect meetings
  ('theme', 'system');                -- 'light', 'dark', 'system'
```

## Audio Capture Implementation

### Windows (WASAPI Loopback)

```typescript
// Uses electron-audio-loopback or native WASAPI
import { getLoopbackStream } from 'electron-audio-loopback';

async function captureSystemAudio() {
  const stream = await getLoopbackStream();
  // Returns MediaStream with system audio
  return stream;
}
```

### macOS (ScreenCaptureKit)

```typescript
// Electron 33+ with Chromium flags for system audio
// OR native Swift binary via child process

// Option 1: Chromium built-in (requires screen permission)
const stream = await navigator.mediaDevices.getDisplayMedia({
  audio: {
    // Chromium internal flags handle loopback
  },
  video: false
});

// Option 2: AudioTee.js for macOS 14.2+ (audio-only permission)
import { AudioTee } from 'audioteejs';
const tee = new AudioTee();
tee.on('data', (pcmData) => {
  // Handle raw audio data
});
await tee.start();
```

### Linux (PulseAudio/PipeWire)

```typescript
// PulseAudio monitor source
const devices = await navigator.mediaDevices.enumerateDevices();
const monitor = devices.find(d => 
  d.kind === 'audioinput' && 
  d.label.includes('.monitor')
);

const stream = await navigator.mediaDevices.getUserMedia({
  audio: { deviceId: monitor.deviceId }
});
```

## IPC Communication

```typescript
// Main process handlers
ipcMain.handle('recording:start', async () => {
  await recorder.start();
  return { success: true };
});

ipcMain.handle('recording:stop', async () => {
  const meeting = await recorder.stop();
  return meeting;
});

ipcMain.handle('meetings:list', async () => {
  return db.getMeetings();
});

ipcMain.handle('meeting:transcribe', async (_, meetingId: string) => {
  return await transcriber.transcribe(meetingId);
});

ipcMain.handle('meeting:summarize', async (_, meetingId: string) => {
  return await summarizer.summarize(meetingId);
});
```

## Security Considerations

### Permissions Required

| Platform | Permission | Reason |
|----------|------------|--------|
| macOS | System Audio Recording | Capture meeting audio |
| macOS | Microphone | Capture user's voice |
| Windows | None (WASAPI doesn't require permission) | - |
| Linux | PulseAudio access | Usually automatic |

### Data Privacy

1. **All audio stored locally** - No cloud uploads unless user enables API transcription
2. **API keys stored securely** - Using electron-store with encryption
3. **No telemetry by default** - Opt-in analytics only
4. **Easy data deletion** - Delete meeting removes all associated files

## Performance Targets

| Metric | Target |
|--------|--------|
| App startup | < 2 seconds |
| Recording start | < 500ms |
| Memory (idle) | < 100MB |
| Memory (recording) | < 200MB |
| CPU (recording) | < 5% |
| Transcription (local) | 2x real-time |
| Transcription (API) | 30s for 1hr audio |

## Future Considerations

### v2 Features

- **Local LLM**: Ollama/llama.cpp for fully offline AI notes
- **AI Chat**: Query past meetings with RAG
- **Real-time transcription**: Stream to Whisper API during recording
- **Calendar integration**: Auto-detect meeting start from calendar
- **Cloud sync**: Optional encrypted backup to cloud storage
- **Team features**: Share transcripts with team members
- **Integrations**: Notion, Slack, Linear, etc.

### Local LLM Strategy

```
┌─────────────────────────────────────────────────────────────┐
│                    Privacy Modes                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │  Full Local  │  │    Hybrid    │  │    Cloud     │       │
│  │              │  │              │  │              │       │
│  │ Whisper.cpp  │  │ Whisper.cpp  │  │ Whisper API  │       │
│  │      +       │  │      +       │  │      +       │       │
│  │   Ollama     │  │  GPT/Claude  │  │  GPT/Claude  │       │
│  │              │  │              │  │              │       │
│  │ Data: None   │  │ Data: Text   │  │ Data: Audio  │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Recommended Local Models:**

| Model | Size | Speed | Quality | Use Case |
|-------|------|-------|---------|----------|
| Llama 3.2 3B | 2GB | Fast | Good | Quick summaries |
| Mistral 7B | 4GB | Medium | Better | Detailed notes |
| Llama 3.1 8B | 5GB | Medium | Great | Best local quality |
| Qwen 2.5 7B | 4GB | Medium | Great | Multilingual |

**Implementation:**
```typescript
// Check if Ollama is running
const ollamaAvailable = await checkOllama();

// Use local or fallback to cloud
const summarize = ollamaAvailable 
  ? summarizeWithOllama(transcript, 'llama3.2')
  : summarizeWithOpenAI(transcript, 'gpt-4o-mini');
```

### Potential Stack Changes

- **Tauri**: Consider migrating if Tauri audio capture matures
- **WebGPU Whisper**: In-browser transcription for even faster local processing
- **MLX**: Apple Silicon optimized inference for macOS
