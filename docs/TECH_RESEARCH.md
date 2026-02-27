# Technical Research

## Audio Capture Across Platforms

### The Challenge

Capturing system audio (what's playing from speakers) is non-trivial because:
1. It requires intercepting audio before it reaches the output device
2. Each OS handles this differently
3. Privacy/security concerns mean it often requires special permissions

### Windows: WASAPI Loopback

**How it works:** Windows Audio Session API (WASAPI) provides a "loopback" mode that captures audio being sent to an output device.

**Implementation:**
```cpp
// Native approach (C++/Rust)
IAudioClient* audioClient;
device->Activate(IID_IAudioClient, CLSCTX_ALL, nullptr, (void**)&audioClient);
audioClient->Initialize(
  AUDCLNT_SHAREMODE_SHARED,
  AUDCLNT_STREAMFLAGS_LOOPBACK,  // Key flag!
  bufferDuration,
  0,
  waveFormat,
  nullptr
);
```

**In Electron:**
- Use `electron-audio-loopback` package
- Or use `desktopCapturer` with audio: true

**Permissions:** None required! WASAPI loopback is available to all apps.

**Pros:**
- No special permissions
- High quality audio
- Low latency

**Cons:**
- Windows only
- Requires understanding of WASAPI

---

### macOS: Multiple Approaches

#### Approach 1: ScreenCaptureKit (macOS 12.3+)

Apple's official API for screen and audio capture.

**In Electron (Chromium):**
```typescript
// Enable via Chromium flags in main process
app.commandLine.appendSwitch('enable-features', 'MacLoopbackAudioForScreenShare');

// In renderer
const stream = await navigator.mediaDevices.getDisplayMedia({
  audio: true,
  video: false // We only want audio
});
```

**Permissions:** Requires "Screen & System Audio Recording" permission (shows purple indicator)

**Pros:**
- Built into Chromium/Electron
- No external dependencies
- Official Apple API

**Cons:**
- Requires screen recording permission (even for audio-only)
- Purple recording indicator in Control Center
- App restart often required after granting permission

#### Approach 2: Core Audio Taps (macOS 14.2+)

Lower-level API that captures audio pre-mixer.

**Implementation via AudioTee.js:**
```typescript
import { AudioTee } from 'audioteejs';

const tee = new AudioTee();
tee.on('data', (buffer: Buffer) => {
  // Raw PCM audio data
  recorder.write(buffer);
});
await tee.start();
```

**Permissions:** Requires only "System Audio Recording Only" (no screen permission)

**Pros:**
- Audio-only permission (no screen indicator)
- Volume-independent capture
- No app restart needed
- Works in background

**Cons:**
- macOS 14.2+ only
- Requires bundling native binary
- More complex packaging

#### Approach 3: Virtual Audio Driver

Install a virtual audio device that acts as a loopback.

**Options:**
- BlackHole (open source)
- Loopback by Rogue Amoeba (commercial)
- Soundflower (deprecated)

**Pros:**
- Works on older macOS versions
- No special permissions

**Cons:**
- Requires user to install additional software
- User must configure audio routing
- Poor UX

**Recommendation:** Use Approach 1 (ScreenCaptureKit via Chromium) for simplicity, consider AudioTee.js for better UX if macOS 14.2+ is acceptable minimum.

---

### Linux: PulseAudio/PipeWire Monitor

**How it works:** PulseAudio and PipeWire create "monitor" sources that mirror output sinks.

**Finding the monitor source:**
```bash
# List all sources
pactl list sources short

# Output includes something like:
# alsa_output.pci-0000_00_1f.3.analog-stereo.monitor
```

**In Electron:**
```typescript
// Enumerate devices and find monitor
const devices = await navigator.mediaDevices.enumerateDevices();
const monitor = devices.find(d => 
  d.kind === 'audioinput' && 
  d.label.toLowerCase().includes('monitor')
);

if (monitor) {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { deviceId: { exact: monitor.deviceId } }
  });
}
```

**Alternative: parec command:**
```typescript
import { spawn } from 'child_process';

// Record from monitor using parec
const parec = spawn('parec', [
  '--device=alsa_output.pci-0000_00_1f.3.analog-stereo.monitor',
  '--file-format=wav',
  'output.wav'
]);
```

**Permissions:** Usually automatic if user is in `audio` group.

**Pros:**
- Simple implementation
- Works with PulseAudio and PipeWire
- No special drivers needed

**Cons:**
- Device names vary by system
- May need fallback detection logic
- PipeWire transition issues on some distros

---

## Transcription Options

### Option 1: Whisper (Local)

Run OpenAI's Whisper model locally using whisper.cpp.

**Setup:**
```bash
# Install whisper.cpp
git clone https://github.com/ggerganov/whisper.cpp
cd whisper.cpp
make

# Download model
./models/download-ggml-model.sh base.en
```

**In Node.js:**
```typescript
import { whisper } from 'whisper-node';

const transcript = await whisper({
  filePath: 'recording.wav',
  modelPath: './models/ggml-base.en.bin',
  language: 'en'
});
```

**Models:**
| Model | Size | Speed | Accuracy |
|-------|------|-------|----------|
| tiny | 75MB | ~32x | Good for English |
| base | 142MB | ~16x | Better accuracy |
| small | 466MB | ~6x | Good multilingual |
| medium | 1.5GB | ~2x | High accuracy |
| large | 3GB | ~1x | Best accuracy |

**Recommendation:** Bundle `base.en` model (142MB) by default, allow downloading larger models.

### Option 2: OpenAI Whisper API

Cloud-based transcription with excellent accuracy.

```typescript
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const transcription = await openai.audio.transcriptions.create({
  file: fs.createReadStream('recording.wav'),
  model: 'whisper-1',
  language: 'en',
  response_format: 'verbose_json', // Includes timestamps
  timestamp_granularities: ['segment']
});
```

**Pricing:** $0.006/minute (~$0.36/hour)

**Pros:**
- Fastest option
- Excellent accuracy
- No local resources needed

**Cons:**
- Requires internet
- Costs money (minimal but not free)
- Privacy concerns (audio sent to cloud)

### Option 3: Hybrid Approach

Use local Whisper for transcription, cloud API for AI notes only.

```
Audio → [Local Whisper] → Transcript → [Cloud GPT] → Notes
                              │
                              └── No audio sent to cloud!
```

---

## Speaker Diarization

Identifying who said what (Speaker 1, Speaker 2, etc.)

### Option 1: pyannote.audio

Industry-standard Python library for speaker diarization.

```python
from pyannote.audio import Pipeline

pipeline = Pipeline.from_pretrained("pyannote/speaker-diarization")
diarization = pipeline("recording.wav")

for turn, _, speaker in diarization.itertracks(yield_label=True):
    print(f"{turn.start:.1f}s - {turn.end:.1f}s: {speaker}")
```

**Integration:** Run as subprocess or use pyodide in Electron.

### Option 2: Whisper + Simple VAD

Whisper's output includes speaker change detection. Combine with Voice Activity Detection (VAD) for basic diarization.

```typescript
// Whisper returns segments with timestamps
// Use audio energy/pause detection to separate speakers
const segments = transcript.segments;
let currentSpeaker = 1;

for (let i = 1; i < segments.length; i++) {
  const gap = segments[i].start - segments[i-1].end;
  if (gap > 2.0) { // 2 second pause = possible speaker change
    currentSpeaker++;
  }
  segments[i].speaker = `Speaker ${currentSpeaker}`;
}
```

### Option 3: AssemblyAI API

Cloud API with built-in diarization.

```typescript
const response = await assemblyai.transcripts.transcribe({
  audio_url: 'https://example.com/audio.wav',
  speaker_labels: true
});

// Returns transcript with speaker labels
response.utterances.forEach(u => {
  console.log(`${u.speaker}: ${u.text}`);
});
```

**Pricing:** $0.012/minute with diarization

---

## AI Summarization

### Local LLM Options

For users who want 100% offline/private AI notes.

#### Option 1: Ollama (Recommended)

Easiest way to run local LLMs. Cross-platform, good performance.

```typescript
import ollama from 'ollama';

const response = await ollama.chat({
  model: 'llama3.2', // or mistral, qwen2.5
  messages: [
    { role: 'system', content: MEETING_SUMMARY_PROMPT },
    { role: 'user', content: transcript }
  ]
});
```

**Models for Meeting Notes:**

| Model | VRAM | Speed | Quality | Notes |
|-------|------|-------|---------|-------|
| `llama3.2:3b` | 2GB | ⚡⚡⚡ | ★★★ | Fast, good for quick summaries |
| `mistral:7b` | 4GB | ⚡⚡ | ★★★★ | Great balance |
| `llama3.1:8b` | 5GB | ⚡⚡ | ★★★★★ | Best quality |
| `qwen2.5:7b` | 4GB | ⚡⚡ | ★★★★ | Best for multilingual |
| `phi3:mini` | 2GB | ⚡⚡⚡ | ★★★ | Microsoft, very fast |

**Integration:**
```typescript
// Check if Ollama is available
async function checkOllama(): Promise<boolean> {
  try {
    await fetch('http://localhost:11434/api/tags');
    return true;
  } catch {
    return false;
  }
}

// Summarize with fallback
async function summarize(transcript: string): Promise<string> {
  const settings = getSettings();
  
  if (settings.aiProvider === 'local') {
    if (await checkOllama()) {
      return summarizeWithOllama(transcript);
    }
    throw new Error('Ollama not running. Start with: ollama serve');
  }
  
  return summarizeWithCloud(transcript);
}
```

#### Option 2: llama.cpp (Direct)

Lower-level, more control, bundled with app.

```typescript
import { LlamaModel, LlamaContext } from 'node-llama-cpp';

const model = new LlamaModel({ modelPath: './models/llama-3.2-3b.gguf' });
const context = new LlamaContext({ model });
const session = new LlamaChatSession({ context });

const response = await session.prompt(transcript);
```

**Pros:** No external dependency, bundled with app
**Cons:** Larger app size (~2-5GB), more complex setup

#### Option 3: MLX (macOS Apple Silicon)

Optimized for M1/M2/M3 chips.

```python
# Via Python subprocess
import mlx_lm

model, tokenizer = mlx_lm.load("mlx-community/Llama-3.2-3B-Instruct-4bit")
response = mlx_lm.generate(model, tokenizer, prompt=transcript)
```

**Pros:** Fastest on Apple Silicon
**Cons:** macOS only, requires Python

### Recommendation

1. **Default:** Cloud (GPT-4o-mini) - easiest, cheapest, best quality
2. **Privacy mode:** Ollama - user installs separately, we detect and use
3. **Future:** Bundle llama.cpp for true zero-dependency local mode

### Prompt Engineering

```typescript
const MEETING_SUMMARY_PROMPT = `
You are a meeting notes assistant. Analyze the following transcript and produce structured notes.

<transcript>
{transcript}
</transcript>

Output the following in Markdown format:

## Summary
A 2-3 sentence overview of what was discussed.

## Key Points
- Bullet points of the main topics discussed
- Include important details mentioned

## Action Items
- [ ] Task description - @person (if assignee mentioned)
- Format as markdown checkboxes

## Decisions Made
- Any decisions that were agreed upon

## Questions/Open Items
- Any unresolved questions or topics for follow-up

Keep the notes concise and actionable. Focus on what matters.
`;
```

### Cost Comparison

| Provider | Model | Input | Output | 1hr meeting (~15k tokens) |
|----------|-------|-------|--------|---------------------------|
| OpenAI | GPT-4o-mini | $0.15/1M | $0.60/1M | ~$0.01 |
| OpenAI | GPT-4o | $2.50/1M | $10/1M | ~$0.19 |
| Anthropic | Claude 3.5 Haiku | $0.80/1M | $4/1M | ~$0.07 |
| Anthropic | Claude 3.5 Sonnet | $3/1M | $15/1M | ~$0.27 |

**Recommendation:** GPT-4o-mini for cost efficiency, Claude Sonnet for quality.

---

## Electron Packaging

### Build Configuration

```yaml
# electron-builder.yml
appId: com.meetlog.app
productName: MeetLog
copyright: Copyright © 2026

mac:
  category: public.app-category.productivity
  hardenedRuntime: true
  gatekeeperAssess: false
  entitlements: build/entitlements.mac.plist
  target:
    - target: dmg
      arch: [x64, arm64]

win:
  target:
    - target: nsis
      arch: [x64]

linux:
  target:
    - target: AppImage
      arch: [x64]
    - target: deb
      arch: [x64]
  category: AudioVideo

extraResources:
  - from: resources/whisper
    to: whisper
    filter:
      - "**/*"
```

### macOS Entitlements

```xml
<!-- build/entitlements.mac.plist -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "...">
<plist version="1.0">
<dict>
  <key>com.apple.security.cs.allow-jit</key>
  <true/>
  <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
  <true/>
  <key>com.apple.security.device.audio-input</key>
  <true/>
  <key>com.apple.security.cs.disable-library-validation</key>
  <true/>
</dict>
</plist>
```

### App Size Optimization

| Component | Size | Optimization |
|-----------|------|--------------|
| Electron | ~180MB | Use electron-builder's compression |
| Whisper base.en | 142MB | Download on first use |
| React + deps | ~5MB | Tree shaking, code splitting |
| **Total (without Whisper)** | ~185MB | |
| **Total (with Whisper)** | ~330MB | |

---

## Performance Benchmarks (Target)

| Operation | Target | Notes |
|-----------|--------|-------|
| App cold start | < 2s | Lazy load non-critical modules |
| Recording start | < 500ms | Pre-initialize audio subsystem |
| Recording CPU | < 5% | Efficient audio buffering |
| Recording RAM | < 200MB | Stream to disk, don't buffer all |
| Transcription (local) | 2x realtime | base.en model |
| Transcription (API) | 30s/1hr | Parallel chunk upload |
| AI summary | < 10s | GPT-4o-mini is fast |

---

## Open Questions

1. **Tauri vs Electron?**
   - Tauri is lighter but audio capture support is immature
   - Electron has proven audio capture solutions
   - **Decision: Start with Electron, consider Tauri for v2**

2. **Local-first vs cloud-first?**
   - Local transcription adds 142MB+ to app size
   - Cloud is simpler but requires API keys
   - **Decision: Support both, default to cloud with easy local option**

3. **Real-time transcription for MVP?**
   - Adds significant complexity
   - Most competitors have it
   - **Decision: Out of scope for v1, plan for v2**

4. **Minimum macOS version?**
   - macOS 14.2+ enables better audio capture
   - macOS 12+ has wider compatibility
   - **Decision: Target macOS 12+, optimize for 14.2+**
