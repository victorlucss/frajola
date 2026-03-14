//! Lightweight mic level monitor for dictation overlay visualization.

use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::Arc;

/// Start monitoring mic audio levels.
/// Writes the current level to a shared atomic instead of emitting events.
pub fn start_level_monitor(
    stop_flag: Arc<AtomicBool>,
) -> Result<(cpal::Stream, Arc<AtomicU32>), String> {
    let host = cpal::default_host();
    let device = host
        .default_input_device()
        .ok_or_else(|| "No input device available".to_string())?;

    let config = device
        .default_input_config()
        .map_err(|e| format!("No input config: {e}"))?;

    let channels = config.channels() as usize;
    let stream_config: cpal::StreamConfig = config.into();

    // Store level as atomic u32 (f32 bits) — zero-cost reads from any thread
    let level_atomic = Arc::new(AtomicU32::new(0));
    let level_writer = level_atomic.clone();

    let stream = device
        .build_input_stream(
            &stream_config,
            move |data: &[f32], _: &cpal::InputCallbackInfo| {
                if stop_flag.load(Ordering::Relaxed) {
                    return;
                }

                let mut sum: f32 = 0.0;
                let mut count: usize = 0;
                if channels > 1 {
                    for frame in data.chunks(channels) {
                        let mono = frame.iter().sum::<f32>() / channels as f32;
                        sum += mono * mono;
                        count += 1;
                    }
                } else {
                    for &s in data {
                        sum += s * s;
                        count += 1;
                    }
                }

                if count == 0 {
                    return;
                }

                let rms = (sum / count as f32).sqrt();
                let level = (rms * 20.0).min(1.0).sqrt().min(1.0);

                level_writer.store(level.to_bits(), Ordering::Relaxed);
            },
            |err| {
                log::error!("Mic level monitor error: {err}");
            },
            None,
        )
        .map_err(|e| format!("Failed to build level monitor stream: {e}"))?;

    stream
        .play()
        .map_err(|e| format!("Failed to start level monitor: {e}"))?;

    Ok((stream, level_atomic))
}
