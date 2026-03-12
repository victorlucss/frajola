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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::audio::encoder::WavEncoder;

    /// Create a test WAV file with a sine tone at the given sample rate and channels.
    fn write_test_wav(path: &std::path::Path, sample_rate: u32, channels: u16, duration_secs: f32) {
        let n_samples = (sample_rate as f32 * duration_secs) as usize;
        let freq = 440.0f32;

        let mut enc = WavEncoder::new(path, sample_rate, channels).unwrap();
        for i in 0..n_samples {
            let sample =
                (2.0 * std::f32::consts::PI * freq * i as f32 / sample_rate as f32).sin() * 0.5;
            for _ in 0..channels {
                enc.write_f32_samples(&[sample]).unwrap();
            }
        }
        enc.finalize().unwrap();
    }

    /// Create a silent WAV file.
    fn write_silent_wav(path: &std::path::Path, sample_rate: u32, channels: u16, duration_secs: f32) {
        let n_samples = (sample_rate as f32 * duration_secs) as usize;
        let samples = vec![0.0f32; n_samples * channels as usize];

        let mut enc = WavEncoder::new(path, sample_rate, channels).unwrap();
        enc.write_f32_samples(&samples).unwrap();
        enc.finalize().unwrap();
    }

    #[test]
    fn load_mono_wav_returns_none_energy() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("mono.wav");
        write_test_wav(&path, 48000, 1, 0.5);

        let (samples, energy) = load_and_resample_with_energy(&path).unwrap();
        assert!(energy.is_none(), "Mono WAV should not produce energy frames");
        // Resampled to 16kHz: 0.5s * 16000 = ~8000 samples
        assert!(samples.len() > 7000 && samples.len() < 9000,
            "Expected ~8000 samples, got {}", samples.len());
    }

    #[test]
    fn load_stereo_wav_returns_energy_frames() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("stereo.wav");
        write_test_wav(&path, 48000, 2, 0.5);

        let (samples, energy) = load_and_resample_with_energy(&path).unwrap();
        assert!(energy.is_some(), "Stereo WAV should produce energy frames");
        let frames = energy.unwrap();
        // 0.5s at 100ms frames = 5 frames (last partial frame may be dropped)
        assert!(frames.len() >= 4 && frames.len() <= 5,
            "Expected 4-5 energy frames, got {}", frames.len());
        // Each frame should have non-zero energy since we wrote a tone
        for frame in &frames {
            assert!(frame.mic_rms > 0.01, "mic_rms too low: {}", frame.mic_rms);
            assert!(frame.sys_rms > 0.01, "sys_rms too low: {}", frame.sys_rms);
        }
        assert!(samples.len() > 7000 && samples.len() < 9000);
    }

    #[test]
    fn load_16khz_wav_skips_resampling() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("16k.wav");
        write_test_wav(&path, 16000, 1, 1.0);

        let (samples, _) = load_and_resample_with_energy(&path).unwrap();
        // Already at 16kHz, should be exactly 16000 samples
        assert_eq!(samples.len(), 16000);
    }

    #[test]
    fn silent_wav_has_near_zero_rms() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("silent.wav");
        write_silent_wav(&path, 48000, 1, 1.0);

        let (samples, _) = load_and_resample_with_energy(&path).unwrap();

        let audio_rms = {
            let sum_sq: f64 = samples.iter().map(|&s| (s as f64) * (s as f64)).sum();
            (sum_sq / samples.len().max(1) as f64).sqrt()
        };
        assert!(audio_rms < 1e-4,
            "Silent WAV should have RMS < 1e-4, got {audio_rms:.6}");
    }

    #[test]
    fn tone_wav_has_meaningful_rms() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("tone.wav");
        write_test_wav(&path, 48000, 1, 1.0);

        let (samples, _) = load_and_resample_with_energy(&path).unwrap();

        let audio_rms = {
            let sum_sq: f64 = samples.iter().map(|&s| (s as f64) * (s as f64)).sum();
            (sum_sq / samples.len().max(1) as f64).sqrt()
        };
        assert!(audio_rms > 0.1,
            "Tone WAV should have meaningful RMS, got {audio_rms:.6}");
    }

    #[test]
    fn rms_of_empty_is_zero() {
        assert_eq!(rms(&[]), 0.0);
    }

    #[test]
    fn rms_of_silence_is_zero() {
        assert_eq!(rms(&[0.0; 1000]), 0.0);
    }

    #[test]
    fn rms_of_dc_signal() {
        let samples = vec![0.5f32; 1000];
        let r = rms(&samples);
        assert!((r - 0.5).abs() < 1e-6, "RMS of DC 0.5 should be 0.5, got {r}");
    }
}
