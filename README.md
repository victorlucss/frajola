# MeetLog

> Free, cross-platform meeting recorder with transcription and AI-powered notes. No bots. Privacy-first.

## What is MeetLog?

MeetLog is a desktop app that records your meetings directly from your computer's audio output and microphone - no need to invite a bot to your calls. It works with any meeting platform (Zoom, Google Meet, Teams, etc.) and generates transcripts and meeting notes automatically.

## Why MeetLog?

| Feature | MeetLog | Jamie | Otter.ai | Fireflies |
|---------|---------|-------|----------|-----------|
| Price | **Free** | $24/mo | $16.99/mo | $18/mo |
| No Meeting Bot | ✅ | ✅ | ⚠️ Optional | ❌ |
| Windows | ✅ | ✅ | ✅ | ✅ |
| macOS | ✅ | ✅ | ✅ | ✅ |
| Linux | ✅ | ❌ | ❌ | ❌ |
| Offline Mode | ✅ | ✅ | ❌ | ❌ |
| Open Source | ✅ | ❌ | ❌ | ❌ |

## Features

### MVP (v1.0)
- [ ] Record system audio + microphone simultaneously
- [ ] Auto-detect meeting start (optional)
- [ ] Generate transcript with speaker diarization
- [ ] AI-powered meeting summary and action items
- [ ] Export to Markdown, PDF, or plain text

### Roadmap
- [ ] Calendar integration (Google, Outlook)
- [ ] Real-time transcription
- [ ] Custom vocabulary and speaker names
- [ ] Team sharing and collaboration
- [ ] Integrations (Notion, Slack, etc.)

## Tech Stack

- **Framework:** Electron
- **Frontend:** React + TypeScript
- **Audio Capture:** Native system audio loopback
- **Transcription:** OpenAI Whisper (local) or API
- **AI Notes:** GPT-4o-mini or Claude
- **Database:** SQLite (local)

## Getting Started

```bash
# Clone the repository
git clone https://github.com/victorlucss/meetlog.git
cd meetlog

# Install dependencies
npm install

# Run in development
npm run dev

# Build for production
npm run build
```

## Documentation

- [Product Requirements](./docs/PRD.md)
- [Competitive Analysis](./docs/COMPETITIVE_ANALYSIS.md)
- [Architecture](./docs/ARCHITECTURE.md)
- [Tech Research](./docs/TECH_RESEARCH.md)

## License

MIT
