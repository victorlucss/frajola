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
    let channels = 1u16; // output mono WAV

    // Create WAV encoder
    let encoder = WavEncoder::new(audio_path, sample_rate, channels)?;

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
    let has_system_audio;
    let mut system_audio_error = None;
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
            Ok(stream) => {
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

    // --- Writer thread ---
    let writer_stop = stop_flag.clone();
    let writer_paused = paused_flag.clone();
    let writer_thread = thread::spawn(move || {
        writer_loop(rx, encoder, writer_stop, writer_paused, has_system_audio)
    });

    Ok(CaptureHandles {
        mic_stream: Some(mic_stream),
        system_stream,
        writer_thread,
        system_audio_error,
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
) -> Result<Stream, String> {
    // On macOS 14.2+: cpal's build_input_stream on an output device creates a
    // CoreAudioTap loopback automatically (requires Screen & System Audio Recording permission).
    // We use default_output_config() since default_input_config() fails on output-only devices.
    let output_device = host
        .default_output_device()
        .ok_or("No default output device available")?;

    let config = output_device
        .default_output_config()
        .map_err(|e| format!("Failed to get output device config: {e}"))?;

    let device_channels = config.channels() as usize;
    let stop = stop_flag.clone();
    let paused = paused_flag.clone();

    build_input_stream(&output_device, &config, device_channels, on_data, stop, paused)
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
) -> Result<(), String> {
    let mut mic_buf: Vec<f32> = Vec::new();
    let mut sys_buf: Vec<f32> = Vec::new();

    loop {
        match rx.recv_timeout(std::time::Duration::from_millis(100)) {
            Ok(chunk) => {
                if paused_flag.load(Ordering::Relaxed) {
                    continue;
                }

                match chunk {
                    AudioChunk::Mic(samples) => mic_buf.extend_from_slice(&samples),
                    AudioChunk::System(samples) => sys_buf.extend_from_slice(&samples),
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
                                    sys_buf.extend_from_slice(&samples)
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

/// Mix and write the overlapping portion of both buffers.
/// If no system audio, just flush mic directly.
fn flush_mixed(
    mic_buf: &mut Vec<f32>,
    sys_buf: &mut Vec<f32>,
    encoder: &mut WavEncoder,
    has_system_audio: bool,
) -> Result<(), String> {
    if !has_system_audio {
        // No system audio — write mic samples directly
        if !mic_buf.is_empty() {
            encoder.write_f32_samples(mic_buf)?;
            mic_buf.clear();
        }
        return Ok(());
    }

    // Mix the overlapping portion (sum mic + system)
    let mix_len = mic_buf.len().min(sys_buf.len());
    if mix_len > 0 {
        let mixed: Vec<f32> = mic_buf[..mix_len]
            .iter()
            .zip(&sys_buf[..mix_len])
            .map(|(m, s)| (m + s).clamp(-1.0, 1.0))
            .collect();
        encoder.write_f32_samples(&mixed)?;
        mic_buf.drain(..mix_len);
        sys_buf.drain(..mix_len);
    }

    Ok(())
}

/// Flush any remaining samples at end of recording.
/// Mix whatever overlaps, then write any leftover from either source.
fn flush_remaining(
    mic_buf: &mut Vec<f32>,
    sys_buf: &mut Vec<f32>,
    encoder: &mut WavEncoder,
) -> Result<(), String> {
    // Mix the overlapping portion
    let mix_len = mic_buf.len().min(sys_buf.len());
    if mix_len > 0 {
        let mixed: Vec<f32> = mic_buf[..mix_len]
            .iter()
            .zip(&sys_buf[..mix_len])
            .map(|(m, s)| (m + s).clamp(-1.0, 1.0))
            .collect();
        encoder.write_f32_samples(&mixed)?;
        mic_buf.drain(..mix_len);
        sys_buf.drain(..mix_len);
    }

    // Write any remaining mic samples
    if !mic_buf.is_empty() {
        encoder.write_f32_samples(mic_buf)?;
        mic_buf.clear();
    }

    // Write any remaining system audio samples
    if !sys_buf.is_empty() {
        encoder.write_f32_samples(sys_buf)?;
        sys_buf.clear();
    }

    Ok(())
}
