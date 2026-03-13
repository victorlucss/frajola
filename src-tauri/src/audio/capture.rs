use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{mpsc, Arc};
use std::thread::{self, JoinHandle};

use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::Stream;

use super::encoder::WavEncoder;

pub struct CaptureHandles {
    pub mic_stream: Option<Stream>,
    pub system_stream: Option<Stream>,
    pub writer_thread: JoinHandle<Result<(), String>>,
    /// If system audio capture failed, contains the reason.
    pub system_audio_error: Option<String>,
    /// Set to `true` if the mic appears silent after the first few seconds of recording.
    pub silence_warning: Arc<AtomicBool>,
}

/// Tagged audio chunk so the writer can distinguish sources.
enum AudioChunk {
    Mic(Vec<f32>),
    System(Vec<f32>),
}

/// Start audio capture with optional mic and system audio streams.
///
/// Both streams push tagged f32 sample chunks into a shared mpsc channel.
/// A writer thread drains the channel and mixes them before writing to WAV.
pub fn start_capture(
    mic_device_name: Option<&str>,
    capture_system_audio: bool,
    audio_path: &Path,
    stop_flag: Arc<AtomicBool>,
    paused_flag: Arc<AtomicBool>,
) -> Result<CaptureHandles, String> {
    let host = cpal::default_host();

    // Determine sample rate from mic device (or system default)
    let mic_device = match mic_device_name {
        Some(id) => host
            .input_devices()
            .map_err(|e| e.to_string())?
            .find(|d| d.id().map(|did| did.to_string() == id).unwrap_or(false))
            .ok_or_else(|| format!("Mic device not found: {id}"))?,
        None => host
            .default_input_device()
            .ok_or("No default input device available")?,
    };

    let mic_config = mic_device
        .default_input_config()
        .map_err(|e| format!("Failed to get mic config: {e}"))?;

    let sample_rate = mic_config.sample_rate();

    // Channel for tagged audio chunks from both streams
    let (tx, rx) = mpsc::channel::<AudioChunk>();

    // --- Mic stream ---
    let mic_tx = tx.clone();
    let mic_stop = stop_flag.clone();
    let mic_paused = paused_flag.clone();
    let mic_channels = mic_config.channels() as usize;

    let mic_stream = build_input_stream(
        &mic_device,
        &mic_config,
        mic_channels,
        move |mono| {
            let _ = mic_tx.send(AudioChunk::Mic(mono));
        },
        mic_stop,
        mic_paused,
    )?;
    mic_stream
        .play()
        .map_err(|e| format!("Failed to start mic stream: {e}"))?;

    // --- System audio (loopback) stream ---
    let mic_rate = sample_rate;
    let has_system_audio;
    let mut system_audio_error = None;
    let mut sys_resample_ratio: Option<f64> = None;
    let system_stream = if capture_system_audio {
        let sys_tx = tx.clone();
        match build_system_audio_stream(
            &host,
            move |mono| {
                let _ = sys_tx.send(AudioChunk::System(mono));
            },
            &stop_flag,
            &paused_flag,
        ) {
            Ok((stream, sys_rate)) => {
                if sys_rate != mic_rate {
                    let ratio = mic_rate as f64 / sys_rate as f64;
                    log::info!(
                        "Sample rate mismatch: mic={mic_rate}Hz, system={sys_rate}Hz, resampling system audio (ratio={ratio:.4})"
                    );
                    sys_resample_ratio = Some(ratio);
                } else {
                    log::info!("Mic and system audio both at {mic_rate}Hz, no resampling needed");
                }
                stream
                    .play()
                    .map_err(|e| format!("Failed to start system audio stream: {e}"))?;
                has_system_audio = true;
                Some(stream)
            }
            Err(e) => {
                log::warn!("System audio capture unavailable: {e}");
                system_audio_error = Some(e);
                has_system_audio = false;
                None
            }
        }
    } else {
        has_system_audio = false;
        None
    };

    // Drop the original sender — mic and system streams hold clones
    drop(tx);

    // Create WAV encoder now that we know the channel count
    let channels = if has_system_audio { 2u16 } else { 1u16 };
    let encoder = WavEncoder::new(audio_path, sample_rate, channels)?;

    // --- Writer thread ---
    let writer_stop = stop_flag.clone();
    let writer_paused = paused_flag.clone();
    let silence_flag = Arc::new(AtomicBool::new(false));
    let writer_silence = silence_flag.clone();
    let writer_sample_rate = sample_rate;
    let writer_thread = thread::spawn(move || {
        writer_loop(
            rx,
            encoder,
            writer_stop,
            writer_paused,
            has_system_audio,
            sys_resample_ratio,
            writer_silence,
            writer_sample_rate,
        )
    });

    Ok(CaptureHandles {
        mic_stream: Some(mic_stream),
        system_stream,
        writer_thread,
        system_audio_error,
        silence_warning: silence_flag,
    })
}

fn build_input_stream(
    device: &cpal::Device,
    config: &cpal::SupportedStreamConfig,
    device_channels: usize,
    on_data: impl Fn(Vec<f32>) + Send + 'static,
    stop_flag: Arc<AtomicBool>,
    paused_flag: Arc<AtomicBool>,
) -> Result<Stream, String> {
    let stream_config: cpal::StreamConfig = config.clone().into();

    let stream = device
        .build_input_stream(
            &stream_config,
            move |data: &[f32], _: &cpal::InputCallbackInfo| {
                if stop_flag.load(Ordering::Relaxed) {
                    return;
                }
                if paused_flag.load(Ordering::Relaxed) {
                    return;
                }

                // Downmix to mono if multi-channel
                let mono: Vec<f32> = if device_channels > 1 {
                    data.chunks(device_channels)
                        .map(|frame| frame.iter().sum::<f32>() / device_channels as f32)
                        .collect()
                } else {
                    data.to_vec()
                };

                on_data(mono);
            },
            |err| {
                log::error!("Audio input stream error: {err}");
            },
            None,
        )
        .map_err(|e| format!("Failed to build input stream: {e}"))?;

    Ok(stream)
}

fn build_system_audio_stream(
    host: &cpal::Host,
    on_data: impl Fn(Vec<f32>) + Send + 'static,
    stop_flag: &Arc<AtomicBool>,
    paused_flag: &Arc<AtomicBool>,
) -> Result<(Stream, u32), String> {
    // On macOS 14.2+: cpal's build_input_stream on an output device creates a
    // CoreAudioTap loopback automatically (requires Screen & System Audio Recording permission).
    // We use default_output_config() since default_input_config() fails on output-only devices.
    let output_device = host
        .default_output_device()
        .ok_or("No default output device available")?;

    let config = output_device
        .default_output_config()
        .map_err(|e| format!("Failed to get output device config: {e}"))?;

    let sys_rate = config.sample_rate();
    let device_channels = config.channels() as usize;
    let stop = stop_flag.clone();
    let paused = paused_flag.clone();

    let stream =
        build_input_stream(&output_device, &config, device_channels, on_data, stop, paused)?;
    Ok((stream, sys_rate))
}

/// Resample audio using linear interpolation.
/// `ratio` = target_rate / source_rate (e.g., 16000/48000 = 0.333 for downsampling).
fn resample_linear(input: &[f32], ratio: f64) -> Vec<f32> {
    if input.is_empty() {
        return Vec::new();
    }
    let out_len = (input.len() as f64 * ratio).round() as usize;
    if out_len == 0 {
        return Vec::new();
    }
    let mut output = Vec::with_capacity(out_len);
    for i in 0..out_len {
        let src_pos = i as f64 / ratio;
        let idx = src_pos as usize;
        let frac = (src_pos - idx as f64) as f32;
        let sample = if idx + 1 < input.len() {
            input[idx] * (1.0 - frac) + input[idx + 1] * frac
        } else {
            input[idx.min(input.len() - 1)]
        };
        output.push(sample);
    }
    output
}

/// Writer thread that mixes mic and system audio before writing to WAV.
///
/// When both sources are active, it buffers each independently and writes
/// the mixed (summed) output once both have enough data. This prevents the
/// old bug where concatenated streams doubled the audio length.
fn writer_loop(
    rx: mpsc::Receiver<AudioChunk>,
    mut encoder: WavEncoder,
    stop_flag: Arc<AtomicBool>,
    paused_flag: Arc<AtomicBool>,
    has_system_audio: bool,
    sys_resample_ratio: Option<f64>,
    silence_flag: Arc<AtomicBool>,
    sample_rate: u32,
) -> Result<(), String> {
    let mut mic_buf: Vec<f32> = Vec::new();
    let mut sys_buf: Vec<f32> = Vec::new();

    // Silence detection: accumulate mic energy for the first 3 seconds
    let mut mic_samples_counted: u64 = 0;
    let mut mic_sum_sq: f64 = 0.0;
    let silence_check_samples = (sample_rate as u64) * 3;
    let mut silence_checked = false;

    loop {
        match rx.recv_timeout(std::time::Duration::from_millis(100)) {
            Ok(chunk) => {
                if paused_flag.load(Ordering::Relaxed) {
                    continue;
                }

                match chunk {
                    AudioChunk::Mic(samples) => {
                        if !silence_checked {
                            for &s in &samples {
                                mic_sum_sq += (s as f64) * (s as f64);
                            }
                            mic_samples_counted += samples.len() as u64;
                            if mic_samples_counted >= silence_check_samples {
                                let rms =
                                    (mic_sum_sq / mic_samples_counted as f64).sqrt();
                                if rms < 1e-4 {
                                    silence_flag.store(true, Ordering::Relaxed);
                                    log::warn!(
                                        "Mic audio appears silent after 3s (RMS={rms:.6})"
                                    );
                                }
                                silence_checked = true;
                            }
                        }
                        mic_buf.extend_from_slice(&samples);
                    }
                    AudioChunk::System(samples) => {
                        let resampled = match sys_resample_ratio {
                            Some(ratio) => resample_linear(&samples, ratio),
                            None => samples,
                        };
                        sys_buf.extend_from_slice(&resampled);
                    }
                }

                flush_mixed(
                    &mut mic_buf,
                    &mut sys_buf,
                    &mut encoder,
                    has_system_audio,
                )?;
            }
            Err(mpsc::RecvTimeoutError::Timeout) => {
                if stop_flag.load(Ordering::Relaxed) {
                    // Drain remaining chunks
                    while let Ok(chunk) = rx.try_recv() {
                        if !paused_flag.load(Ordering::Relaxed) {
                            match chunk {
                                AudioChunk::Mic(samples) => {
                                    mic_buf.extend_from_slice(&samples)
                                }
                                AudioChunk::System(samples) => {
                                    let resampled = match sys_resample_ratio {
                                        Some(ratio) => resample_linear(&samples, ratio),
                                        None => samples,
                                    };
                                    sys_buf.extend_from_slice(&resampled);
                                }
                            }
                        }
                    }

                    // Final flush — write whatever remains
                    flush_remaining(&mut mic_buf, &mut sys_buf, &mut encoder)?;
                    break;
                }
            }
            Err(mpsc::RecvTimeoutError::Disconnected) => {
                flush_remaining(&mut mic_buf, &mut sys_buf, &mut encoder)?;
                break;
            }
        }
    }

    encoder.finalize()?;
    Ok(())
}

/// Interleave two mono channels into stereo: [L0, R0, L1, R1, ...]
fn interleave_stereo(left: &[f32], right: &[f32]) -> Vec<f32> {
    let len = left.len().min(right.len());
    let mut out = Vec::with_capacity(len * 2);
    for i in 0..len {
        out.push(left[i]);
        out.push(right[i]);
    }
    out
}

/// Write the overlapping portion of both buffers as stereo interleaved samples.
/// If no system audio, just flush mic directly (mono).
fn flush_mixed(
    mic_buf: &mut Vec<f32>,
    sys_buf: &mut Vec<f32>,
    encoder: &mut WavEncoder,
    has_system_audio: bool,
) -> Result<(), String> {
    if !has_system_audio {
        if !mic_buf.is_empty() {
            encoder.write_f32_samples(mic_buf)?;
            mic_buf.clear();
        }
        return Ok(());
    }

    // Interleave the overlapping portion as stereo (L=mic, R=system)
    let overlap = mic_buf.len().min(sys_buf.len());
    if overlap > 0 {
        let stereo = interleave_stereo(&mic_buf[..overlap], &sys_buf[..overlap]);
        encoder.write_f32_samples(&stereo)?;
        mic_buf.drain(..overlap);
        sys_buf.drain(..overlap);
    }

    Ok(())
}

/// Flush any remaining samples at end of recording.
/// Pad the shorter channel with silence to match lengths, then interleave as stereo.
/// If only mic data exists (no system audio was active), write mono directly.
fn flush_remaining(
    mic_buf: &mut Vec<f32>,
    sys_buf: &mut Vec<f32>,
    encoder: &mut WavEncoder,
) -> Result<(), String> {
    if sys_buf.is_empty() && !mic_buf.is_empty() {
        // Mono-only path (no system audio) — write mic directly
        encoder.write_f32_samples(mic_buf)?;
        mic_buf.clear();
        return Ok(());
    }

    // Pad the shorter buffer with silence so both have equal length
    let max_len = mic_buf.len().max(sys_buf.len());
    mic_buf.resize(max_len, 0.0);
    sys_buf.resize(max_len, 0.0);

    if max_len > 0 {
        let stereo = interleave_stereo(mic_buf, sys_buf);
        encoder.write_f32_samples(&stereo)?;
    }

    mic_buf.clear();
    sys_buf.clear();
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    // --- Linear resampling tests ---

    #[test]
    fn resample_linear_empty_input() {
        assert!(resample_linear(&[], 0.5).is_empty());
    }

    #[test]
    fn resample_linear_same_rate() {
        let input = vec![1.0, 2.0, 3.0, 4.0];
        let output = resample_linear(&input, 1.0);
        assert_eq!(output.len(), input.len());
        for (a, b) in input.iter().zip(&output) {
            assert!((a - b).abs() < 1e-6);
        }
    }

    #[test]
    fn resample_linear_downsample_halves() {
        let input: Vec<f32> = (0..100).map(|i| i as f32).collect();
        let output = resample_linear(&input, 0.5);
        assert_eq!(output.len(), 50);
        // First sample should be close to 0.0
        assert!(output[0].abs() < 1e-6);
    }

    #[test]
    fn resample_linear_upsample_doubles() {
        let input = vec![0.0, 1.0, 0.0];
        let output = resample_linear(&input, 2.0);
        assert_eq!(output.len(), 6);
        // Should interpolate smoothly
        assert!(output[0].abs() < 1e-6); // 0.0
        assert!(output[2] > 0.4); // near 1.0
    }

    #[test]
    fn resample_linear_preserves_silence() {
        let input = vec![0.0f32; 1000];
        let output = resample_linear(&input, 0.333);
        for s in &output {
            assert_eq!(*s, 0.0, "Silence should remain silent after resampling");
        }
    }

    // --- Interleave tests ---

    #[test]
    fn interleave_stereo_basic() {
        let left = vec![1.0, 3.0, 5.0];
        let right = vec![2.0, 4.0, 6.0];
        let stereo = interleave_stereo(&left, &right);
        assert_eq!(stereo, vec![1.0, 2.0, 3.0, 4.0, 5.0, 6.0]);
    }

    #[test]
    fn interleave_stereo_unequal_lengths() {
        let left = vec![1.0, 3.0, 5.0];
        let right = vec![2.0, 4.0];
        let stereo = interleave_stereo(&left, &right);
        // Should only interleave min(3,2)=2 frames
        assert_eq!(stereo, vec![1.0, 2.0, 3.0, 4.0]);
    }

    // --- Silence detection integration test ---

    #[test]
    fn writer_loop_detects_silence() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("silence_test.wav");
        let encoder = WavEncoder::new(&path, 48000, 1).unwrap();

        let (tx, rx) = mpsc::channel::<AudioChunk>();
        let stop_flag = Arc::new(AtomicBool::new(false));
        let paused_flag = Arc::new(AtomicBool::new(false));
        let silence_flag = Arc::new(AtomicBool::new(false));
        let silence_clone = silence_flag.clone();
        let stop_clone = stop_flag.clone();

        let handle = thread::spawn(move || {
            writer_loop(
                rx, encoder, stop_clone, paused_flag, false, None,
                silence_clone, 48000,
            )
        });

        // Send 4 seconds of silent mic audio in chunks
        for _ in 0..400 {
            tx.send(AudioChunk::Mic(vec![0.0f32; 480])).unwrap();
        }

        // Give the writer thread a moment to process
        std::thread::sleep(std::time::Duration::from_millis(100));

        // Stop and join
        stop_flag.store(true, Ordering::Relaxed);
        drop(tx);
        handle.join().unwrap().unwrap();

        assert!(silence_flag.load(Ordering::Relaxed),
            "Silence flag should be set for silent audio");
    }

    #[test]
    fn writer_loop_no_silence_for_tone() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("tone_test.wav");
        let encoder = WavEncoder::new(&path, 48000, 1).unwrap();

        let (tx, rx) = mpsc::channel::<AudioChunk>();
        let stop_flag = Arc::new(AtomicBool::new(false));
        let paused_flag = Arc::new(AtomicBool::new(false));
        let silence_flag = Arc::new(AtomicBool::new(false));
        let silence_clone = silence_flag.clone();
        let stop_clone = stop_flag.clone();

        let handle = thread::spawn(move || {
            writer_loop(
                rx, encoder, stop_clone, paused_flag, false, None,
                silence_clone, 48000,
            )
        });

        // Send 4 seconds of 440Hz tone in chunks
        let freq = 440.0f32;
        let sample_rate = 48000.0f32;
        for chunk_idx in 0..400 {
            let chunk: Vec<f32> = (0..480)
                .map(|i| {
                    let t = (chunk_idx * 480 + i) as f32 / sample_rate;
                    (2.0 * std::f32::consts::PI * freq * t).sin() * 0.5
                })
                .collect();
            tx.send(AudioChunk::Mic(chunk)).unwrap();
        }

        std::thread::sleep(std::time::Duration::from_millis(100));
        stop_flag.store(true, Ordering::Relaxed);
        drop(tx);
        handle.join().unwrap().unwrap();

        assert!(!silence_flag.load(Ordering::Relaxed),
            "Silence flag should NOT be set for audio with tone");
    }

    // --- Full round-trip: write WAV → read → check RMS ---

    #[test]
    fn roundtrip_silent_wav_detected_by_rms_check() {
        use crate::transcribe::resample::load_and_resample_with_energy;

        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("roundtrip_silent.wav");

        // Simulate a recording that produces silence (e.g., no mic permission)
        let encoder = WavEncoder::new(&path, 48000, 1).unwrap();
        let (tx, rx) = mpsc::channel::<AudioChunk>();
        let stop_flag = Arc::new(AtomicBool::new(false));
        let paused_flag = Arc::new(AtomicBool::new(false));
        let silence_flag = Arc::new(AtomicBool::new(false));
        let stop_clone = stop_flag.clone();

        let handle = thread::spawn(move || {
            writer_loop(
                rx, encoder, stop_clone, paused_flag, false, None,
                silence_flag, 48000,
            )
        });

        // Send 1 second of silence
        for _ in 0..100 {
            tx.send(AudioChunk::Mic(vec![0.0f32; 480])).unwrap();
        }
        stop_flag.store(true, Ordering::Relaxed);
        drop(tx);
        handle.join().unwrap().unwrap();

        // Now load the WAV through the transcription pipeline
        let (samples, _) = load_and_resample_with_energy(&path).unwrap();

        let audio_rms = {
            let sum_sq: f64 = samples.iter().map(|&s| (s as f64) * (s as f64)).sum();
            (sum_sq / samples.len().max(1) as f64).sqrt()
        };

        assert!(audio_rms < 1e-4,
            "Silent recording should be caught by RMS check (got {audio_rms:.6})");
    }

    #[test]
    fn roundtrip_tone_wav_passes_rms_check() {
        use crate::transcribe::resample::load_and_resample_with_energy;

        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("roundtrip_tone.wav");

        let encoder = WavEncoder::new(&path, 48000, 1).unwrap();
        let (tx, rx) = mpsc::channel::<AudioChunk>();
        let stop_flag = Arc::new(AtomicBool::new(false));
        let paused_flag = Arc::new(AtomicBool::new(false));
        let silence_flag = Arc::new(AtomicBool::new(false));
        let stop_clone = stop_flag.clone();

        let handle = thread::spawn(move || {
            writer_loop(
                rx, encoder, stop_clone, paused_flag, false, None,
                silence_flag, 48000,
            )
        });

        // Send 1 second of 440Hz tone
        let freq = 440.0f32;
        for chunk_idx in 0..100 {
            let chunk: Vec<f32> = (0..480)
                .map(|i| {
                    let t = (chunk_idx * 480 + i) as f32 / 48000.0;
                    (2.0 * std::f32::consts::PI * freq * t).sin() * 0.5
                })
                .collect();
            tx.send(AudioChunk::Mic(chunk)).unwrap();
        }
        stop_flag.store(true, Ordering::Relaxed);
        drop(tx);
        handle.join().unwrap().unwrap();

        let (samples, _) = load_and_resample_with_energy(&path).unwrap();

        let audio_rms = {
            let sum_sq: f64 = samples.iter().map(|&s| (s as f64) * (s as f64)).sum();
            (sum_sq / samples.len().max(1) as f64).sqrt()
        };

        assert!(audio_rms > 0.1,
            "Tone recording should pass RMS check (got {audio_rms:.6})");
    }
}
