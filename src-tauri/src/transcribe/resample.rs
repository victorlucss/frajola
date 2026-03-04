use std::path::Path;

use rubato::{Resampler, SincFixedIn, SincInterpolationParameters, SincInterpolationType, WindowFunction};

use crate::error::AppError;

const TARGET_SAMPLE_RATE: usize = 16_000;

/// Per-frame energy measurement for mic and system channels.
#[derive(Debug, Clone)]
pub struct EnergyFrame {
    pub time_ms: i64,
    pub mic_rms: f32,
    pub sys_rms: f32,
}

/// Load a WAV, extract per-channel energy if stereo, downmix to mono, resample to 16kHz.
///
/// Returns `(samples_16k, Some(energy_frames))` for stereo WAVs (L=mic, R=system),
/// or `(samples_16k, None)` for mono WAVs (backward compatible).
pub fn load_and_resample_with_energy(wav_path: &Path) -> Result<(Vec<f32>, Option<Vec<EnergyFrame>>), AppError> {
    let reader = hound::WavReader::open(wav_path)
        .map_err(|e| AppError::General(format!("Failed to open WAV: {e}")))?;

    let spec = reader.spec();
    let source_rate = spec.sample_rate as usize;
    let channels = spec.channels as usize;

    // Read all samples as f32
    let raw_samples: Vec<f32> = match spec.sample_format {
        hound::SampleFormat::Int => reader
            .into_samples::<i16>()
            .map(|s| s.map(|v| v as f32 / i16::MAX as f32))
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| AppError::General(format!("Failed to read WAV samples: {e}")))?,
        hound::SampleFormat::Float => reader
            .into_samples::<f32>()
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| AppError::General(format!("Failed to read WAV samples: {e}")))?,
    };

    // Separate channels and compute energy if stereo
    let (mono, energy) = if channels == 2 {
        let (left, right) = deinterleave_stereo(&raw_samples);
        let energy = compute_energy_frames(&left, &right, source_rate);
        // Downmix to mono by averaging L+R
        let mono: Vec<f32> = left.iter().zip(&right).map(|(l, r)| (l + r) * 0.5).collect();
        (mono, Some(energy))
    } else if channels == 1 {
        (raw_samples, None)
    } else {
        // >2 channels: downmix to mono, no energy
        let mono = raw_samples
            .chunks(channels)
            .map(|frame| frame.iter().sum::<f32>() / channels as f32)
            .collect();
        (mono, None)
    };

    // If already at target rate, return directly
    if source_rate == TARGET_SAMPLE_RATE {
        return Ok((mono, energy));
    }

    // Resample using rubato SincFixedIn
    let params = SincInterpolationParameters {
        sinc_len: 256,
        f_cutoff: 0.95,
        interpolation: SincInterpolationType::Linear,
        oversampling_factor: 256,
        window: WindowFunction::BlackmanHarris2,
    };

    let mut resampler = SincFixedIn::<f32>::new(
        TARGET_SAMPLE_RATE as f64 / source_rate as f64,
        2.0,
        params,
        mono.len(),
        1, // mono
    )
    .map_err(|e| AppError::General(format!("Failed to create resampler: {e}")))?;

    let resampled = resampler
        .process(&[&mono], None)
        .map_err(|e| AppError::General(format!("Resampling failed: {e}")))?;

    Ok((resampled.into_iter().next().unwrap_or_default(), energy))
}

/// Separate interleaved stereo [L0, R0, L1, R1, ...] into two mono vectors.
fn deinterleave_stereo(interleaved: &[f32]) -> (Vec<f32>, Vec<f32>) {
    let n = interleaved.len() / 2;
    let mut left = Vec::with_capacity(n);
    let mut right = Vec::with_capacity(n);
    for frame in interleaved.chunks_exact(2) {
        left.push(frame[0]);
        right.push(frame[1]);
    }
    (left, right)
}

/// Compute per-100ms RMS energy for mic (left) and system (right) channels.
fn compute_energy_frames(left: &[f32], right: &[f32], sample_rate: usize) -> Vec<EnergyFrame> {
    let frame_samples = sample_rate / 10; // 100ms frames
    let n_frames = left.len() / frame_samples;
    let mut frames = Vec::with_capacity(n_frames);

    for i in 0..n_frames {
        let start = i * frame_samples;
        let end = start + frame_samples;
        let mic_rms = rms(&left[start..end]);
        let sys_rms = rms(&right[start..end]);
        frames.push(EnergyFrame {
            time_ms: (i * 100) as i64,
            mic_rms,
            sys_rms,
        });
    }

    frames
}

fn rms(samples: &[f32]) -> f32 {
    if samples.is_empty() {
        return 0.0;
    }
    let sum_sq: f32 = samples.iter().map(|s| s * s).sum();
    (sum_sq / samples.len() as f32).sqrt()
}
