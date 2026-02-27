# Technical Research

## Audio Capture Across Platforms

### The Challenge

Capturing system audio (what's playing from speakers) is non-trivial because:
1. It requires intercepting audio before it reaches the output device
2. Each OS handles this differently
3. Privacy/security concerns mean it often requires special permissions

All audio capture in Frajola is handled in Rust using **cpal** (cross-platform audio library) with platform-specific strategies for system audio loopback.

---

### Windows: cpal + WASAPI Loopback

**How it works:** Windows Audio Session API (WASAPI) provides a "loopback" mode that captures audio being sent to an output device. cpal supports this natively.

**Implementation approach:**
```rust
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};

// cpal on Windows uses WASAPI by default
// Loopback capture is available by selecting an output device
// and opening it as an input stream
let host = cpal::default_host();

// Enumerate output devices (for loopback capture)
for device in host.output_devices()? {
    println!("Output device: {}", device.name()?);
}

// For microphone capture, use input devices as normal
let mic = host.default_input_device()
    .expect("No input device available");
```

**Permissions:** None required. WASAPI loopback is available to all apps.

**Status:** Low risk. cpal + WASAPI is well-tested and widely used.

---

### macOS: ScreenCaptureKit + cpal

macOS is the most complex platform for system audio capture.

#### Approach 1: screencapturekit-rs (Recommended)

Rust bindings to Apple's ScreenCaptureKit framework (macOS 12.3+). Provides audio-only capture without needing a screen recording.

```rust
// Using screencapturekit-rs crate
// Provides SCStream-based capture with audio-only option
// Requires "Screen & System Audio Recording" permission on macOS 15+
// or "Screen Recording" permission on macOS 12-14
```

**Permissions:** Requires "Screen & System Audio Recording" (shows purple indicator in Control Center). On macOS 15+, there's a separate "System Audio Recording Only" entitlement.

**Pros:**
- Official Apple API with Rust bindings
- Audio-only capture possible
- No external dependencies

**Cons:**
- Requires screen recording permission even for audio-only (macOS 12-14)
- App restart sometimes required after granting permission
- Rust bindings are young — may need patches

#### Approach 2: objc2 bindings (Fallback)

Direct Objective-C runtime calls from Rust using the `objc2` crate to access CoreAudio or ScreenCaptureKit APIs manually.

**Pros:** Full control, no dependency on third-party bindings
**Cons:** Much more code, harder to maintain, requires deep Apple API knowledge

#### Approach 3: Virtual Audio Driver (Last Resort)

Instruct the user to install BlackHole (open source virtual audio device) and route audio through it.

**Pros:** Works on all macOS versions, no special permissions
**Cons:** Terrible UX — requires manual setup, confusing for non-technical users

**Recommendation:** Start with screencapturekit-rs. Fall back to objc2 if bindings are insufficient. Virtual audio driver is documented as a manual workaround only.

**Microphone:** cpal handles mic capture on macOS natively via CoreAudio. No issues expected.

**Status:** **High risk.** This is the hardest platform. Phase 2 of development (3 weeks) is dedicated to proving this works.

---

### Linux: cpal + PulseAudio/PipeWire Monitor

**How it works:** PulseAudio and PipeWire create "monitor" sources that mirror output sinks. cpal can capture from these.

**Finding and using monitor sources:**
```bash
# List all sources (monitor sources are what we need)
pactl list sources short

# Output includes something like:
# alsa_output.pci-0000_00_1f.3.analog-stereo.monitor
```

In Rust with cpal:
```rust
use cpal::traits::{DeviceTrait, HostTrait};

let host = cpal::default_host();

// Enumerate input devices — monitor sources appear here
for device in host.input_devices()? {
    let name = device.name()?;
    if name.contains("monitor") {
        // This is a loopback/monitor source
        println!("Monitor source: {}", name);
    }
}
```

**Permissions:** Usually automatic if user is in `audio` group.

**Challenges:**
- Device names vary by system and sound card
- Need fallback detection logic (look for `.monitor` suffix)
- PipeWire transition: some distros are mid-migration from PulseAudio

**Status:** Medium risk. cpal handles PulseAudio well, but device enumeration logic needs robust fallbacks.

---

## Transcription: whisper-rs

### Local Transcription (Default)

We use **whisper-rs** — Rust bindings to whisper.cpp — for local transcription.

```rust
use whisper_rs::{WhisperContext, WhisperContextParameters, FullParams, SamplingStrategy};

// Load model
let ctx = WhisperContext::new_with_params(
    "models/ggml-base.bin",
    WhisperContextParameters::default(),
)?;

// Configure transcription
let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });
params.set_language(Some("en")); // or "pt" for Portuguese, or None for auto-detect
params.set_print_progress(false);
params.set_token_timestamps(true);

// Run transcription
let mut state = ctx.create_state()?;
state.full(params, &audio_samples)?; // audio_samples: &[f32] at 16kHz

// Extract segments with timestamps
let num_segments = state.full_n_segments()?;
for i in 0..num_segments {
    let start_ms = state.full_get_segment_t0(i)? * 10; // centiseconds → ms
    let end_ms = state.full_get_segment_t1(i)? * 10;
    let text = state.full_get_segment_text(i)?;
    // Save to transcript_segments table
}
```

### Whisper Models

| Model | Size | Speed | Accuracy | Languages |
|-------|------|-------|----------|-----------|
| tiny | 75MB | ~32x realtime | Good | Multilingual |
| base | 142MB | ~16x realtime | Better | Multilingual |
| small | 466MB | ~6x realtime | Good | Multilingual |
| medium | 1.5GB | ~2x realtime | High | Multilingual |
| large-v3 | 3GB | ~1x realtime | Best | Multilingual |

**Recommendation for pt-BR + English:**
- Default: `base` model (142MB) — good balance of speed and accuracy
- Allow user to select model size in settings (tiny → large)
- Download model on first use, not bundled with app

**Language detection:** whisper-rs can auto-detect language from the first 30 seconds of audio. We use this to set the meeting language and select the appropriate AI prompt template.

### Cloud Transcription (Opt-in)

For users who prefer cloud transcription (better accuracy, faster on long recordings):

```rust
// Using reqwest to call OpenAI Whisper API
use reqwest::multipart;

async fn transcribe_cloud(audio_path: &str, api_key: &str) -> Result<Transcript> {
    let client = reqwest::Client::new();
    let file = tokio::fs::read(audio_path).await?;

    let form = multipart::Form::new()
        .part("file", multipart::Part::bytes(file).file_name("audio.wav"))
        .text("model", "whisper-1")
        .text("response_format", "verbose_json")
        .text("timestamp_granularities[]", "segment");

    let response = client
        .post("https://api.openai.com/v1/audio/transcriptions")
        .bearer_auth(api_key)
        .multipart(form)
        .send()
        .await?;

    // Parse segments and save to DB
    Ok(response.json().await?)
}
```

**Pricing:** ~$0.006/minute (~$0.36/hour)

---

## Speaker Detection: Basic VAD

### What MVP Does

MVP uses a simple voice activity detection (VAD) approach: silence gaps > 2 seconds are treated as potential speaker changes. This is explicitly **not** speaker diarization.

```rust
/// Basic VAD-based speaker change detection
/// Looks for silence gaps between transcript segments
fn assign_speakers(segments: &mut [TranscriptSegment]) {
    let mut current_speaker = 1;

    for i in 1..segments.len() {
        let gap_ms = segments[i].start_ms - segments[i - 1].end_ms;
        if gap_ms > 2000 {
            // 2 second silence = possible speaker change
            current_speaker += 1;
        }
        segments[i].speaker = format!("Speaker {}", current_speaker);
    }
}
```

### Honest Assessment

This approach has significant limitations:
- **Cannot distinguish speakers who talk in quick succession** (no silence gap)
- **Will create false speaker changes** during pauses by the same speaker
- **Cannot identify returning speakers** (Speaker 1 who talks again later gets a new label)
- **No voice fingerprinting** — purely timing-based

### What Real Diarization Requires (v2)

True speaker diarization needs ML models that analyze voice characteristics:

1. **pyannote.audio** — Industry-standard Python library, requires running a Python subprocess or sidecar
2. **AssemblyAI API** — Cloud API with built-in diarization ($0.012/minute)
3. **Custom embedding model** — Extract speaker embeddings and cluster them

For v2, the most practical approach is offering an AssemblyAI or similar cloud API for users who need accurate speaker labels, while keeping the basic VAD as a free local fallback.

---

## AI Summarization

### Local: Ollama via reqwest (Default)

Frajola uses **reqwest** (Rust HTTP client) to communicate with Ollama's local API. No Node.js SDK needed.

```rust
use reqwest::Client;
use serde::{Deserialize, Serialize};

#[derive(Serialize)]
struct OllamaRequest {
    model: String,
    messages: Vec<Message>,
    stream: bool,
}

#[derive(Serialize, Deserialize)]
struct Message {
    role: String,
    content: String,
}

#[derive(Deserialize)]
struct OllamaResponse {
    message: Message,
}

async fn summarize_with_ollama(transcript: &str, model: &str) -> Result<String> {
    let client = Client::new();

    let request = OllamaRequest {
        model: model.to_string(),
        messages: vec![
            Message {
                role: "system".to_string(),
                content: MEETING_SUMMARY_PROMPT.to_string(),
            },
            Message {
                role: "user".to_string(),
                content: transcript.to_string(),
            },
        ],
        stream: false,
    };

    let response: OllamaResponse = client
        .post("http://localhost:11434/api/chat")
        .json(&request)
        .send()
        .await?
        .json()
        .await?;

    Ok(response.message.content)
}

/// Check if Ollama is running
async fn check_ollama() -> bool {
    reqwest::get("http://localhost:11434/api/tags")
        .await
        .is_ok()
}
```

### Cloud APIs (Opt-in)

For users who prefer cloud AI (better quality, no local setup):

```rust
// OpenAI API via reqwest
async fn summarize_with_openai(transcript: &str, api_key: &str) -> Result<String> {
    let client = Client::new();

    let body = serde_json::json!({
        "model": "gpt-4o-mini",
        "messages": [
            {"role": "system", "content": MEETING_SUMMARY_PROMPT},
            {"role": "user", "content": transcript}
        ]
    });

    let response = client
        .post("https://api.openai.com/v1/chat/completions")
        .bearer_auth(api_key)
        .json(&body)
        .send()
        .await?;

    // Parse response and extract content
    Ok(parse_openai_response(response).await?)
}
```

### Models for Meeting Notes (Ollama)

| Model | VRAM | Speed | Quality | Best For |
|-------|------|-------|---------|----------|
| `llama3.2:3b` | 2GB | Fast | Good | Quick summaries, low-end hardware |
| `mistral:7b` | 4GB | Medium | Better | Detailed notes |
| `llama3.1:8b` | 5GB | Medium | Great | Best local quality |
| `qwen2.5:7b` | 4GB | Medium | Great | Multilingual (pt-BR) |

### AI Provider Priority

1. **Default:** Ollama (local) — if Ollama is detected running
2. **Fallback prompt:** If Ollama not detected, show setup instructions and offer cloud opt-in
3. **Cloud opt-in:** User provides their own OpenAI or Anthropic API key

We never default to cloud. The user must explicitly choose it.

### Prompt Engineering

```rust
const MEETING_SUMMARY_PROMPT_EN: &str = r#"
You are a meeting notes assistant. Analyze the following transcript and produce structured notes.

Output in Markdown format:

## Summary
A 2-3 sentence overview of what was discussed.

## Key Points
- Bullet points of the main topics discussed

## Action Items
- [ ] Task description - @person (if assignee mentioned)

## Decisions Made
- Any decisions that were agreed upon

Keep the notes concise and actionable. Focus on what matters.
"#;

const MEETING_SUMMARY_PROMPT_PT: &str = r#"
Voce e um assistente de notas de reuniao. Analise a transcricao a seguir e produza notas estruturadas.

Formato em Markdown:

## Resumo
Uma visao geral de 2-3 frases sobre o que foi discutido.

## Pontos Principais
- Topicos principais discutidos em bullet points

## Itens de Acao
- [ ] Descricao da tarefa - @pessoa (se mencionado)

## Decisoes Tomadas
- Decisoes que foram acordadas

Mantenha as notas concisas e acionaveis. Foque no que importa.
"#;
```

### Cost Comparison (Cloud APIs)

| Provider | Model | Input | Output | 1hr meeting (~15k tokens) |
|----------|-------|-------|--------|---------------------------|
| OpenAI | GPT-4o-mini | $0.15/1M | $0.60/1M | ~$0.01 |
| OpenAI | GPT-4o | $2.50/1M | $10/1M | ~$0.19 |
| Anthropic | Claude Haiku 4.5 | $0.80/1M | $4/1M | ~$0.07 |
| Anthropic | Claude Sonnet 4.6 | $3/1M | $15/1M | ~$0.27 |
| **Ollama** | **Any model** | **Free** | **Free** | **$0.00** |

---

## Tauri v2 Bundling & Distribution

### Build Configuration

Tauri v2 uses `tauri.conf.json` for build configuration:

```json
{
  "$schema": "https://raw.githubusercontent.com/nicegui/nicegui/main/nicegui/tailwind.json",
  "productName": "Frajola",
  "identifier": "app.frajola.desktop",
  "build": {
    "frontendDist": "../dist"
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ],
    "macOS": {
      "minimumSystemVersion": "12.0",
      "frameworks": [],
      "entitlements": "Entitlements.plist"
    },
    "windows": {
      "wix": null,
      "nsis": {}
    },
    "linux": {
      "deb": { "depends": ["libwebkit2gtk-4.1-0"] },
      "appimage": {}
    }
  },
  "app": {
    "windows": [
      {
        "title": "Frajola",
        "width": 1024,
        "height": 768,
        "minWidth": 800,
        "minHeight": 600
      }
    ],
    "security": {
      "csp": "default-src 'self'; connect-src 'self' http://localhost:11434"
    }
  }
}
```

### macOS Entitlements

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>com.apple.security.device.audio-input</key>
  <true/>
  <key>com.apple.security.app-sandbox</key>
  <false/>
</dict>
</plist>
```

> Note: App sandbox is disabled for MVP because system audio capture (ScreenCaptureKit) and Ollama HTTP communication require it. We may revisit sandboxing in a future version with targeted exceptions.

### App Size Comparison

| Component | Electron | Tauri v2 |
|-----------|----------|----------|
| Runtime | ~180MB | ~5MB |
| React + deps | ~5MB | ~5MB |
| **Total (no Whisper)** | **~185MB** | **~10MB** |
| Whisper base model | +142MB | +142MB |

Tauri produces binaries **~18x smaller** than Electron.

---

## Performance Benchmarks (Target)

| Operation | Target | Notes |
|-----------|--------|-------|
| App cold start | < 1s | Tauri is much lighter than Electron |
| Recording start | < 500ms | Pre-initialize cpal subsystem |
| Recording CPU | < 5% | Efficient audio buffering via cpal |
| Recording RAM | < 80MB | Stream to disk, don't buffer |
| Transcription (local) | ~2x realtime | base model, depends on hardware |
| Transcription (API) | 30s/1hr | Parallel chunk upload |
| AI summary (Ollama) | 10-30s | Depends on model and hardware |
| AI summary (cloud) | < 10s | GPT-4o-mini is fast |

---

## Resolved Questions

1. **Tauri vs Electron?**
   - **Resolved: Tauri v2.** ~18x smaller binary, Rust backend enables native audio via cpal, better security model with capabilities. User is comfortable with Rust.

2. **Local-first vs cloud-first?**
   - **Resolved: Local-first.** whisper-rs for transcription, Ollama for AI. Cloud is opt-in only. This aligns with our privacy-first positioning.

3. **Real-time transcription for MVP?**
   - **Resolved: No.** Post-meeting only for v1. Real-time adds significant complexity.

4. **Minimum macOS version?**
   - Target macOS 12+ for broad compatibility. ScreenCaptureKit available from 12.3+.

## Open Questions

1. **screencapturekit-rs maturity?**
   - The crate exists but is relatively new. May need patches or contributions.
   - Fallback: objc2 manual bindings or virtual audio driver workaround.

2. **Whisper model download UX?**
   - Models are 75MB-3GB. How to handle first-run download?
   - Options: download on first use with progress bar, or let user manually place model files.

3. **Ollama detection and setup guidance?**
   - If Ollama isn't running, how do we guide the user?
   - Plan: detect on app start, show setup dialog with install instructions and link.
