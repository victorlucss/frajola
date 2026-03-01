use std::path::Path;

use rubato::{Resampler, SincFixedIn, SincInterpolationParameters, SincInterpolationType, WindowFunction};

use crate::error::AppError;

const TARGET_SAMPLE_RATE: usize = 16_000;

/// Load a WAV file and resample to 16kHz mono f32 samples for Whisper.
pub fn load_and_resample(wav_path: &Path) -> Result<Vec<f32>, AppError> {
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

    // Downmix to mono if multichannel
    let mono: Vec<f32> = if channels == 1 {
        raw_samples
    } else {
        raw_samples
            .chunks(channels)
            .map(|frame| frame.iter().sum::<f32>() / channels as f32)
            .collect()
    };

    // If already at target rate, return directly
    if source_rate == TARGET_SAMPLE_RATE {
        return Ok(mono);
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

    Ok(resampled.into_iter().next().unwrap_or_default())
}
