# Competitive Analysis

## Market Overview

The AI meeting notes market is growing rapidly as remote/hybrid work becomes permanent. Key players have raised significant funding and the market is estimated at $2B+ by 2025.

## Positioning

**Frajola's position:** Privacy-first meeting recorder for technical users.

We are not trying to be "the free Amie." We serve a different audience — developers, engineers, and privacy-conscious professionals who want local-first processing, Linux support, and open-source transparency. The overlap with Amie is the "no bot" UX, not the target market.

## Direct Competitors

### 1. Amie (amie.so) — PRIMARY INSPIRATION (UX only)

**What they do:** Elegant AI note taker with macOS notch integration, AI chat, and smart integrations.

**Key Features:**
- Notch UI on macOS — beautiful, non-intrusive
- Pause/resume recording (speak "off the record")
- AI Chat — ask questions about any past meeting
- Email drafts in your writing style
- Integrations: Hubspot, Pipedrive, Notion, Slack, Linear
- Speaker memory — remembers names across meetings
- Calendar integration — auto-record scheduled meetings

**Pricing:** Paid (pricing not public)

**Strengths:**
- Exceptional UX and design
- No meeting bot
- Context-aware AI (knows your business)
- Full workflow automation

**Weaknesses:**
- macOS only
- Paid, closed source
- Cloud-only processing

**What we take from Amie:** The "no bot" approach and clean UX.
**What we don't take:** The premium/cloud-only positioning.

---

### 2. Jamie (meetjamie.ai)

**What they do:** Bot-free AI meeting assistant that captures system audio directly.

**Pricing:** $24-99/month

**Strengths:**
- No meeting bot
- Works offline
- High-quality AI summaries

**Weaknesses:**
- Expensive ($24-99/month)
- No Linux support
- Closed source

---

### 3. Otter.ai

**What they do:** AI meeting transcription with both bot and bot-free options.

**Pricing:** Free (300 min/month) to $30/month

**Strengths:**
- Strong free tier
- Real-time transcription
- Good accuracy

**Weaknesses:**
- Bot-based recording is default
- No Linux support
- Limited offline capability

---

### 4. Fireflies.ai

**What they do:** AI meeting assistant that joins calls as a bot.

**Pricing:** Free (800 min storage) to $29/month

**Strengths:**
- Excellent CRM integrations
- Good cross-meeting search

**Weaknesses:**
- Requires a bot (no bot-free option)
- No desktop app
- Privacy concerns

---

### 5. Fathom

**What they do:** Free AI meeting recorder for Zoom/Meet/Teams.

**Pricing:** Free to $19/user/month

**Strengths:**
- Generous free tier
- Good Zoom integration

**Weaknesses:**
- Bot-based
- No offline mode
- No Linux

---

## Competitive Matrix

| Feature | Frajola (MVP) | Frajola (Planned) | Amie | Jamie | Otter |
|---------|---------------|-------------------|------|-------|-------|
| **Price** | Free | Free | Paid | $24+ | $17+ |
| **No Bot** | Yes | Yes | Yes | Yes | Partial |
| **Windows** | Yes | Yes | No | Yes | Yes |
| **macOS** | Yes | Yes | Yes | Yes | Yes |
| **Linux** | Yes | Yes | No | No | No |
| **Local Transcription** | Yes | Yes | No | Yes | No |
| **Local AI** | Yes (Ollama) | Yes | No | No | No |
| **Speaker Detection** | Basic (VAD) | ML-based (v2) | Yes | Yes | Yes |
| **AI Chat** | No | v2 | Yes | No | Partial |
| **Calendar** | No | v2 | Yes | No | Yes |
| **Integrations** | No | v3 | Yes | Partial | Yes |
| **Open Source** | Yes | Yes | No | No | No |
| **Fully Offline** | Yes | Yes | No | Yes | No |

> The "MVP vs Planned" split is intentional. We are honest about what ships in v1 vs what's on the roadmap.

## Key Differentiators

### 1. Privacy-First + Local by Default
Not just "we support local" — local is the **default**. Whisper runs on your machine. Ollama runs on your machine. No data leaves your device unless you opt in.

### 2. Linux Support
The only meeting recorder with full Linux support. Critical for developers and the open-source community.

### 3. Open Source
Full transparency. Users can audit the code, self-host, or contribute.

### 4. Free, No Limits
No subscription, no usage caps, no "10 meetings/month" restrictions.

### 5. No Bot, Ever
Works with any audio source — Zoom, Meet, Teams, Discord, phone calls, in-person (via mic).

## Target Market Gap

```
              Privacy
                 ▲
                 │
    Full Local   │   Frajola ★
    + Free       │
    + Open Source │
                 │
    ─────────────┼────────────────────
                 │
    Cloud-only   │   Amie ●   Jamie ●
    + Paid       │
    + Closed     │   Otter ●  Fireflies ●
                 │
                 └──────────────────────► Platform Coverage
              macOS-only          Cross-Platform + Linux
```

**Frajola fills the gap:** Privacy-first + Free + Cross-Platform + Open Source.

No other product occupies this quadrant.

## Branding

**Name:** Frajola (Brazilian Portuguese name for Sylvester the cat)
**Domain:** frajola.app
**Tagline:** "Privacy-first meeting recorder. No bots. Local by default."
**Positioning:** The meeting recorder for people who care about where their data goes.

## Go-to-Market Strategy

### Launch Channels
1. **Hacker News** — Technical audience, Linux users, privacy-conscious
2. **Reddit** — r/linux, r/selfhosted, r/privacy, r/productivity
3. **Dev.to / Hashnode** — Developer audience
4. **Product Hunt** — Early adopter visibility
5. **GitHub** — README, topics, discussions

### Key Messages
- "Your meeting audio never leaves your machine (unless you want it to)"
- "The only meeting recorder that runs on Linux"
- "Open source. Free forever. No bots."
- "Powered by Whisper + Ollama — no API keys needed"

### Content Strategy
- "How to record meetings privately on Linux" tutorial
- "Local-first meeting notes with Whisper and Ollama" blog post
- Comparison posts: Frajola vs Jamie, Frajola vs Otter
- Video demo showing fully offline workflow
