# Product Requirements Document (PRD)

## Overview

**Product Name:** Frajola 🐱  
**Website:** [frajola.app](https://frajola.app)  
**Tagline:** Free meeting notes, powered by AI. No bots needed.  
**Inspiration:** [Amie](https://amie.so) - the elegant AI note taker  
**Target Launch:** Q2 2026

## Problem Statement

Professionals spend hours in meetings every week but struggle to:
1. Remember key decisions and action items
2. Share meeting context with absent teammates
3. Search past discussions for important information

**Amie** solves this beautifully on macOS with:
- Elegant notch UI
- No meeting bots
- AI chat to query past meetings
- Smart integrations

But Amie is:
- **macOS only** - No Windows or Linux
- **Paid** - Subscription pricing
- **Closed source** - No transparency

Existing alternatives like Fireflies.ai and Otter.ai require intrusive meeting bots that:
- Alert all participants to recording
- Create awkward dynamics in sensitive meetings
- Don't work for in-person or phone calls
- Require expensive subscriptions ($15-30/month)

## Solution

Frajola is a **free, open-source desktop app** that records meetings directly from your computer's audio output, with no bot joining the call. It generates transcripts and AI-powered meeting notes automatically.

## Target Users

### Primary Persona: Remote Professional
- Works remotely 3+ days/week
- Attends 8-15 meetings per week
- Uses Zoom, Google Meet, or Teams
- Needs to share notes with team or keep personal records
- Privacy-conscious about meeting recordings

### Secondary Persona: Freelancer/Consultant
- Takes client calls frequently
- Needs to document discussions for contracts/billing
- Works across multiple platforms
- Price-sensitive (prefers free tools)

## Value Proposition

| For | Who | Frajola is a | That | Unlike |
|-----|-----|--------------|------|--------|
| Remote professionals | attend many meetings | free meeting recorder | captures and summarizes discussions without intrusive bots | Jamie, Otter.ai, Fireflies |

## Core Features (MVP)

### 1. Audio Recording
**User Story:** As a user, I want to record my meeting audio so I can review it later.

**Requirements:**
- Capture system audio (meeting audio) and microphone simultaneously
- Support for all major platforms (Windows, macOS, Linux)
- Visual indicator showing recording is active
- Manual start/stop recording
- Auto-pause when no audio detected (battery saving)

**Acceptance Criteria:**
- [ ] Recording captures both system audio and microphone
- [ ] Audio quality is clear and intelligible
- [ ] Recording indicator is always visible when active
- [ ] Recordings are saved locally with timestamps

### 2. Transcription
**User Story:** As a user, I want my recording transcribed so I can read and search it.

**Requirements:**
- Convert audio to text with high accuracy
- **Languages:** English and Português Brasileiro (MVP)
- Speaker diarization (identify different speakers)
- Timestamps for each segment
- Auto-detect language or manual selection

**Acceptance Criteria:**
- [ ] Transcription accuracy > 90% for clear audio
- [ ] Works with English and Portuguese audio
- [ ] Different speakers are identified (Speaker 1, Speaker 2, etc.)
- [ ] Timestamps are included every 30 seconds or on speaker change
- [ ] Transcription completes within 2x audio duration

### 3. AI Meeting Notes
**User Story:** As a user, I want AI-generated meeting notes so I can quickly understand key points.

**Requirements:**
- Generate structured summary from transcript
- Extract action items with assignees (if mentioned)
- Identify key decisions made
- Highlight important topics discussed

**Output Format:**
```markdown
# Meeting: [Auto-detected or user-provided title]
**Date:** 2026-02-27 14:00  
**Duration:** 45 minutes  
**Participants:** Speaker 1, Speaker 2, Speaker 3

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

## Full Transcript
[Collapsible or linked]
```

### 4. Meeting Library
**User Story:** As a user, I want to browse and search my past meetings.

**Requirements:**
- List all recorded meetings with date, duration, title
- Search across transcripts and notes
- Filter by date range
- Delete recordings permanently

### 5. Export
**User Story:** As a user, I want to export my notes to share with others.

**Requirements:**
- Export to Markdown (.md)
- Export to PDF
- Export to plain text (.txt)
- Copy to clipboard

### 6. Multilingual Support (i18n)
**User Story:** As a Brazilian user, I want the app in Portuguese so I can use it comfortably.

**Requirements:**
- App UI available in English and Português Brasileiro
- Auto-detect system language
- Manual language selection in settings
- AI-generated notes in the same language as the meeting

**Acceptance Criteria:**
- [ ] All UI strings are translatable (i18n framework)
- [ ] App detects system language and sets default
- [ ] User can switch language in settings
- [ ] AI summaries match meeting language (English meeting → English notes)

## Non-Goals (MVP)

These are explicitly out of scope for v1.0:

- Real-time transcription during meeting
- Calendar integration
- Team/collaboration features
- Video recording
- Cloud sync
- Mobile app
- Integrations (Notion, Slack, etc.)

## Technical Constraints

### Platform Requirements
- Windows 10+ (x64)
- macOS 12+ (Intel and Apple Silicon)
- Linux (Ubuntu 20.04+, Fedora 35+)

### Audio Capture Challenges
- **Windows:** WASAPI loopback API
- **macOS:** ScreenCaptureKit (14.2+) or Chromium loopback flags
- **Linux:** PulseAudio monitor source or PipeWire

### Privacy Requirements
- All audio stored locally by default
- Transcription can run locally (Whisper) or via API (user choice)
- No telemetry without explicit consent
- Easy data deletion

## Success Metrics

### Launch (first 30 days)
- 1,000 downloads
- 500 active users (recorded at least 1 meeting)
- 4.0+ average rating if on app stores

### Growth (90 days)
- 5,000 active users
- 80% of users record 3+ meetings
- NPS score > 40

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Audio capture fails on some systems | High | Extensive testing matrix, clear error messages, fallback options |
| Transcription quality too low | High | Offer both local (Whisper) and cloud (OpenAI API) options |
| Linux support too complex | Medium | Deprioritize if needed, focus on Windows/Mac first |
| Users expect real-time transcription | Medium | Clear messaging that v1 is post-meeting only |

## Timeline

### Phase 1: Foundation (2 weeks)
- Project setup (Electron, React, TypeScript)
- Basic UI shell
- Audio recording proof of concept

### Phase 2: Core Recording (2 weeks)
- System audio capture (all platforms)
- Microphone capture
- Audio mixing and storage

### Phase 3: Transcription (2 weeks)
- Whisper integration (local)
- OpenAI API integration (cloud option)
- Speaker diarization

### Phase 4: AI Notes (1 week)
- GPT/Claude integration for summarization
- Note template and formatting

### Phase 5: Polish & Launch (1 week)
- Meeting library and search
- Export functionality
- Bug fixes and testing
- Landing page and distribution

**Total: 8 weeks to MVP**
