use std::path::Path;

use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters};

use crate::error::AppError;
use crate::transcribe::resample::EnergyFrame;

#[derive(Debug)]
pub struct Segment {
    pub start_ms: i64,
    pub end_ms: i64,
    pub text: String,
    pub speaker: Option<String>,
}

/// Run Whisper inference on 16kHz mono f32 audio samples.
///
/// When `energy` is provided (stereo recording), uses mic vs system RMS to assign
/// "You" (mic dominant) or "Other" (system dominant) speaker labels.
/// When `energy` is `None` (mono/old recordings), falls back to tinydiarize.
pub fn transcribe(
    model_path: &Path,
    samples_16k: &[f32],
    language: Option<&str>,
    energy: Option<&[EnergyFrame]>,
) -> Result<Vec<Segment>, AppError> {
    let ctx = WhisperContext::new_with_params(
        model_path
            .to_str()
            .ok_or_else(|| AppError::General("Invalid model path".into()))?,
        WhisperContextParameters::default(),
    )
    .map_err(|e| AppError::General(format!("Failed to load Whisper model: {e}")))?;

    let mut state = ctx
        .create_state()
        .map_err(|e| AppError::General(format!("Failed to create Whisper state: {e}")))?;

    let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });

    // If a language is explicitly set, use it; otherwise let Whisper auto-detect
    params.set_language(language);

    // Only enable tinydiarize when we don't have energy-based diarization
    params.set_tdrz_enable(energy.is_none());
    params.set_print_special(false);
    params.set_print_progress(false);
    params.set_print_realtime(false);
    params.set_print_timestamps(false);

    state
        .full(params, samples_16k)
        .map_err(|e| AppError::General(format!("Whisper inference failed: {e}")))?;

    let n_segments = state
        .full_n_segments()
        .map_err(|e| AppError::General(format!("Failed to get segment count: {e}")))?;

    let mut segments = Vec::with_capacity(n_segments as usize);
    let mut current_speaker = 1u32;

    for i in 0..n_segments {
        let start_cs = state
            .full_get_segment_t0(i)
            .map_err(|e| AppError::General(format!("Failed to get segment start: {e}")))?;
        let end_cs = state
            .full_get_segment_t1(i)
            .map_err(|e| AppError::General(format!("Failed to get segment end: {e}")))?;
        let text = state
            .full_get_segment_text(i)
            .map_err(|e| AppError::General(format!("Failed to get segment text: {e}")))?;

        // Strip the [SPEAKER_TURN] token that tinydiarize may inject
        let cleaned = text.replace("[SPEAKER_TURN]", "");
        let trimmed = cleaned.trim().to_string();
        if trimmed.is_empty() {
            continue;
        }

        let start_ms = start_cs * 10;
        let end_ms = end_cs * 10;

        let speaker_label = if let Some(frames) = energy {
            // Energy-based: compare mic vs system RMS over the segment range
            speaker_from_energy(frames, start_ms, end_ms)
        } else {
            // Tinydiarize fallback
            let label = format!("Speaker {current_speaker}");
            if state.full_get_segment_speaker_turn_next(i) {
                current_speaker += 1;
            }
            label
        };

        segments.push(Segment {
            start_ms,
            end_ms,
            text: trimmed,
            speaker: Some(speaker_label),
        });
    }

    Ok(segments)
}

/// Determine speaker label by comparing each channel's energy relative to its own baseline.
///
/// The mic always picks up more absolute energy because it captures the user's voice
/// directly PLUS echo of the remote speaker through speakers. Comparing absolute levels
/// would make almost every segment "You". Instead, we normalize each channel against
/// its own global average and compare the relative deviation — when the system channel
/// spikes relative to its own baseline more than the mic does, the remote speaker is active.
fn speaker_from_energy(frames: &[EnergyFrame], start_ms: i64, end_ms: i64) -> String {
    let mut mic_sum = 0.0f64;
    let mut sys_sum = 0.0f64;
    let mut count = 0u32;

    for frame in frames {
        if frame.time_ms + 100 > start_ms && frame.time_ms < end_ms {
            mic_sum += frame.mic_rms as f64;
            sys_sum += frame.sys_rms as f64;
            count += 1;
        }
    }

    if count == 0 {
        return "You".into();
    }

    let mic_avg = mic_sum / count as f64;
    let sys_avg = sys_sum / count as f64;

    // Compute global averages for normalization
    let n = frames.len().max(1) as f64;
    let global_mic_avg: f64 = frames.iter().map(|f| f.mic_rms as f64).sum::<f64>() / n;
    let global_sys_avg: f64 = frames.iter().map(|f| f.sys_rms as f64).sum::<f64>() / n;

    // If system audio is essentially silent throughout, everything is "You"
    if global_sys_avg < 1e-4 {
        return "You".into();
    }

    // If mic is essentially silent throughout, everything is "Other"
    if global_mic_avg < 1e-4 {
        return "Other".into();
    }

    // Compare how much each channel deviates from its own baseline.
    // When the remote person speaks, system audio spikes relative to its average
    // more than the mic does relative to its average.
    let mic_ratio = mic_avg / global_mic_avg;
    let sys_ratio = sys_avg / global_sys_avg;

    if sys_ratio > mic_ratio {
        "Other".into()
    } else {
        "You".into()
    }
}
