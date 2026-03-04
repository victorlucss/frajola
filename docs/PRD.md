# Product Requirements Document (PRD)

## Overview

**Product Name:** Frajola
**Website:** [frajola.app](https://frajola.app)
**Tagline:** Privacy-first meeting recorder. No bots. Local by default.
**Target Launch:** Q3 2026

## Problem Statement

Professionals spend hours in meetings every week but struggle to:
1. Remember key decisions and action items
2. Share meeting context with absent teammates
3. Search past discussions for important information

Existing solutions either:
- **Require intrusive bots** (Fireflies, Fathom) that join calls, alert participants, and create awkward dynamics
- **Are macOS-only** (Amie, ChatGPT Record) leaving Windows/Linux users without options
- **Require expensive subscriptions** ($15-100/month for Jamie, Otter, etc.)
- **Are cloud-only** with no option for fully local/private processing

## Solution

Frajola is a **free, open-source desktop app** built with Tauri v2 that records meetings directly from your computer's audio output — no bot joining the call. It generates transcripts locally via whisper-rs and AI-powered meeting notes via Ollama, with optional cloud APIs for users who prefer them.

**Key principle:** Everything runs locally by default. Cloud is opt-in, never the default.

## Delivery Status (as of 2026-03-04)

| Area | Status | Notes |
|------|--------|-------|
| First-run onboarding | ✅ Completed | Mode selection, proactive macOS permission checks, Whisper setup, Ollama setup, skip-AI path, overlay usage tips |
| Audio recording pipeline | ✅ Completed | Mic + system audio capture, pause/resume, WAV local storage |
| Local transcription (Whisper) | ✅ Completed | `tiny/base/small/medium` model management and background transcription |
| AI summaries | ✅ Completed | Ollama local by default, OpenAI/Anthropic opt-in for summaries |
| Overlay controls | ✅ Completed | Floating overlay appears when app is minimized/hidden and can control recording |
| Meeting library browsing | ✅ Completed | Meeting list + detail view with transcript, summary, action items, and audio player |
| Meeting search & filters | ❌ Not completed | FTS is in schema, but no user-facing search/filter UI yet |
| Export (Markdown/PDF/clipboard) | ❌ Not completed | Not implemented |
| UI i18n (en + pt-BR) | ❌ Not completed | Interface is currently English-only |
| Cloud transcription (OpenAI Whisper API) | ❌ Not completed | Transcription is currently local-only |
| Hardware-based model recommendation | ❌ Not completed | Planned |
| Git integration for artifacts | ❌ Not completed | Planned |

## Target Users

### Primary Persona: Privacy-Conscious Technical User
- Developer, engineer, or technical professional
- Works remotely 3+ days/week, attends 8-15 meetings per week
- Uses Zoom, Google Meet, or Teams
- Uncomfortable with cloud-only meeting recorders handling their audio
- Runs Linux or prefers open-source tools
- Willing to install Ollama or run local models

### Secondary Persona: Freelancer/Consultant
- Takes client calls frequently
- Needs to document discussions for contracts/billing
- Works across multiple platforms
- Price-sensitive (prefers free tools)

## Core Features (MVP)

### 1. Audio Recording
**User Story:** As a user, I want to record my meeting audio so I can review it later.

**Requirements:**
- [x] Capture system audio (meeting output) and microphone simultaneously
- [ ] Support for Windows, macOS, and Linux (architecture exists, validation is still pending)
- [x] Visual indicator showing recording is active
- [x] Manual start/stop recording
- [x] Pause/resume recording

**Acceptance Criteria:**
- [x] Recording captures both system audio and microphone
- [ ] Audio quality is clear and intelligible
- [x] Recording indicator is always visible when active
- [x] Recordings are saved locally as WAV files with timestamps

### 2. Transcription
**User Story:** As a user, I want my recording transcribed so I can read and search it.

**Requirements:**
- [x] Convert audio to text locally via whisper-rs
- [ ] **Languages:** English and Portugues Brasileiro (MVP) with validated QA targets
- [x] Timestamps for each segment
- [x] Auto-detect language (manual selection UX not implemented)
- [x] Local transcription via whisper-rs (default)
- [ ] Cloud transcription via OpenAI Whisper API (opt-in)

**Acceptance Criteria:**
- [ ] Transcription accuracy > 90% for clear audio
- [ ] Works with English and Portuguese audio (formal acceptance test suite pending)
- [ ] Timestamps are included every 30 seconds or on pause detection
- [ ] Transcription completes within ~2x audio duration (local)

> **Technical Honesty Note — Speaker Diarization:** MVP uses basic VAD (voice activity detection) to detect speaker changes based on silence gaps. This is naive and will produce inaccurate speaker labels. True speaker diarization requires ML models like pyannote.audio and is out of scope for v1. We label this as "basic speaker change detection" in the UI, not "speaker diarization." Real diarization is planned for v2, likely via a cloud API.

### 3. AI Meeting Notes
**User Story:** As a user, I want AI-generated meeting notes so I can quickly understand key points.

**Requirements:**
- [x] Generate structured summary from transcript
- [x] Extract action items with assignees (if mentioned)
- [x] Identify key decisions made
- [x] Highlight important topics discussed
- [x] Default to Ollama (local), with OpenAI/Anthropic APIs opt-in for summaries

**Output Format:**
```markdown
# Meeting: [Auto-detected or user-provided title]
**Date:** 2026-02-27 14:00
**Duration:** 45 minutes

## Summary
Brief 2-3 sentence overview of the meeting.

## Key Points
- Point 1
- Point 2
- Point 3

## Action Items
- [ ] Action item 1 - @Person (if mentioned)
- [ ] Action item 2

## Decisions Made
- Decision 1
- Decision 2
```

### 4. Meeting Library
**User Story:** As a user, I want to browse and search my past meetings.

**Requirements:**
- [x] List all recorded meetings with date, duration, title
- [ ] Full-text search across transcripts and notes (FTS5)
- [ ] Filter by date range
- [ ] Delete recordings permanently (DB rows delete; audio file cleanup still pending)

### 5. Export
**User Story:** As a user, I want to export my notes to share with others.

**Requirements:**
- [ ] Export to Markdown (.md)
- [ ] Export to PDF
- [ ] Copy to clipboard

### 6. Multilingual Support (i18n)
**User Story:** As a Brazilian user, I want the app in Portuguese so I can use it comfortably.

**Requirements:**
- [ ] App UI available in English and Portugues Brasileiro
- [ ] Auto-detect system language
- [ ] Manual language selection in settings
- [ ] AI-generated notes in the same language as the meeting

**Acceptance Criteria:**
- [ ] All UI strings are translatable (i18n framework)
- [ ] App detects system language and sets default
- [ ] User can switch language in settings
- [ ] AI summaries match meeting language

### 7. First-Run Onboarding
**User Story:** As a first-time user, I want guided setup so I can record quickly without manual troubleshooting.

**Requirements:**
- [x] First launch opens a guided onboarding flow
- [x] Proactive macOS permission checks on the permission cards
- [x] Whisper model selection with recommended default
- [x] Ollama setup flow (install/start/check status)
- [x] Ollama model selection from light to heavy presets (including Qwen options)
- [x] Ability to skip AI and continue in transcription-only mode
- [x] Overlay-only usage guidance (minimize/close main window behavior)
- [ ] Recommend best AI model using user hardware/system info

## Non-Goals (MVP)

These are explicitly out of scope for v1.0:

- Real-time transcription during meeting
- Calendar integration
- Auto-detect meeting start/end (requires calendar integration)
- Auto-pause when no audio detected (battery saving — v2 feature)
- True speaker diarization (ML-based)
- Team/collaboration features
- Video recording
- Cloud sync
- Mobile app
- Integrations (Notion, Slack, etc.)

## Technical Constraints

### Platform Requirements
- Windows 10+ (x64) — target, not fully validated yet
- macOS 14.2+ (Intel and Apple Silicon) — current implemented baseline in Tauri config
- Linux (Ubuntu 20.04+, Fedora 35+) — target, not fully validated yet

### Audio Capture (Highest Risk)
- **Windows:** cpal + WASAPI loopback — native support, no permissions needed
- **macOS:** screencapturekit-rs or objc2 bindings for system audio (requires permission), cpal for mic
- **Linux:** cpal + PulseAudio/PipeWire monitor sources

### Privacy Requirements
- All processing local by default (whisper-rs + Ollama)
- Cloud APIs are opt-in only, requiring user-provided API keys
- No telemetry, no analytics, no phone-home
- Easy data deletion

## Success Metrics

### Launch (first 30 days)
- 500 GitHub stars
- 200 downloads
- Working on all 3 platforms

### Growth (90 days)
- 2,000 GitHub stars
- 1,000 active users
- Community contributions (PRs, translations)

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| macOS system audio capture is complex | High | Invest time in Phase 2 PoC, have fallback strategies (screencapturekit-rs, virtual audio driver) |
| whisper-rs performance on low-end hardware | Medium | Offer cloud API fallback, allow model size selection (tiny→large) |
| Ollama not installed by user | Medium | Clear setup guide, detect and prompt, cloud fallback available |
| Linux audio stack fragmentation | Medium | Test PulseAudio + PipeWire, provide troubleshooting docs |
| Users expect real speaker diarization | Medium | Honest labeling in UI ("basic speaker change detection"), roadmap transparency |

## Timeline

### Phase 1: Scaffolding + Landing Page (Weeks 1-2)
- Tauri v2 project setup (Rust + React + TypeScript)
- Database schema (rusqlite + migrations)
- Landing page (static HTML/CSS)
- CI/CD pipeline

### Phase 2: Audio Capture PoC (Weeks 3-5) — HIGHEST RISK
- cpal integration for mic capture
- System audio capture per platform (WASAPI, ScreenCaptureKit, PulseAudio)
- Audio mixing (system + mic → WAV)
- Cross-platform testing

### Phase 3: UI Shell + Meeting Library (Weeks 6-7)
- React app shell with Tailwind CSS 4
- Recording controls component
- Meeting list and detail views
- SQLite CRUD operations via Tauri commands

### Phase 4: Transcription Pipeline (Weeks 8-10)
- whisper-rs integration
- Segment storage in DB
- Basic VAD for speaker change hints
- Cloud API fallback (OpenAI Whisper)
- FTS5 search

### Phase 5: AI Summarization (Weeks 11-12)
- Ollama HTTP client (reqwest)
- Prompt templates (en + pt-BR)
- Summary/action items parsing and storage
- Cloud API fallback (OpenAI, Anthropic)

### Phase 6: Export + Polish (Weeks 13-14)
- Markdown export
- PDF export
- Settings UI
- UX polish and bug fixes

### Phase 7: i18n + Packaging (Weeks 15-18)
- pt-BR translations
- Cross-platform testing matrix
- Tauri bundler config (dmg, msi, AppImage/deb)
- Documentation and README updates
- Beta release

**Total: 14-18 weeks to MVP**

### Phase Completion Snapshot (as of 2026-03-04)
- [x] Phase 1: Scaffolding + Landing Page
- [x] Phase 2: Audio Capture PoC (core functionality)
- [x] Phase 3: UI Shell + Meeting Library (browse/detail flows)
- [ ] Phase 4: Transcription Pipeline (cloud fallback + search still pending)
- [x] Phase 5: AI Summarization
- [ ] Phase 6: Export + Polish (export not started)
- [ ] Phase 7: i18n + Packaging

## Technical Honesty Notes

1. **Speaker diarization is hard.** We will not pretend basic VAD is real diarization. The UI will honestly label it as "speaker change detection (basic)" and the roadmap will clearly state that ML-based diarization is a v2 feature.

2. **macOS audio capture is the biggest risk.** ScreenCaptureKit requires system permissions and the Rust bindings are young. This is why Phase 2 is 3 weeks and marked as highest risk.

3. **Local AI quality varies.** Ollama with a 3B model won't match GPT-4o quality. We'll be transparent about this in the UI and let users easily switch to cloud if they want better results.

4. **WAV files are large.** A 1-hour meeting at 16kHz mono 16-bit is ~115MB. This is acceptable for MVP. OPUS encoding (planned optimization) would reduce this to ~5-10MB.
