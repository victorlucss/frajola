use std::fs::File;
use std::io::BufWriter;
use std::path::Path;

use hound::{SampleFormat, WavSpec, WavWriter};

pub struct WavEncoder {
    writer: WavWriter<BufWriter<File>>,
}

impl WavEncoder {
    pub fn new(path: &Path, sample_rate: u32, channels: u16) -> Result<Self, String> {
        let spec = WavSpec {
            channels,
            sample_rate,
            bits_per_sample: 16,
            sample_format: SampleFormat::Int,
        };
        let writer = WavWriter::create(path, spec)
            .map_err(|e| format!("Failed to create WAV file: {e}"))?;
        Ok(WavEncoder { writer })
    }

    /// Write f32 samples, converting to i16 without intermediate allocation.
    pub fn write_f32_samples(&mut self, samples: &[f32]) -> Result<(), String> {
        for &sample in samples {
            self.writer
                .write_sample(f32_to_i16(sample))
                .map_err(|e| format!("Failed to write sample: {e}"))?;
        }
        Ok(())
    }

    pub fn finalize(self) -> Result<(), String> {
        self.writer
            .finalize()
            .map_err(|e| format!("Failed to finalize WAV: {e}"))?;
        Ok(())
    }
}

/// Convert f32 audio sample (range -1.0..1.0) to i16.
pub fn f32_to_i16(sample: f32) -> i16 {
    (sample.clamp(-1.0, 1.0) * i16::MAX as f32) as i16
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn f32_to_i16_converts_full_range() {
        assert_eq!(f32_to_i16(1.0), i16::MAX);
        assert_eq!(f32_to_i16(-1.0), -i16::MAX);
        assert_eq!(f32_to_i16(0.0), 0);
    }

    #[test]
    fn f32_to_i16_clamps_overflow() {
        assert_eq!(f32_to_i16(2.0), i16::MAX);
        assert_eq!(f32_to_i16(-2.0), -i16::MAX);
    }

    #[test]
    fn f32_to_i16_near_zero_is_silent() {
        assert_eq!(f32_to_i16(1e-6), 0);
        assert_eq!(f32_to_i16(-1e-6), 0);
    }

    #[test]
    fn wav_encoder_writes_and_reads_back() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("test.wav");

        let sample_rate = 48000u32;
        let freq = 440.0f32;
        let samples: Vec<f32> = (0..sample_rate)
            .map(|i| (2.0 * std::f32::consts::PI * freq * i as f32 / sample_rate as f32).sin())
            .collect();

        let mut enc = WavEncoder::new(&path, sample_rate, 1).unwrap();
        enc.write_f32_samples(&samples).unwrap();
        enc.finalize().unwrap();

        let reader = hound::WavReader::open(&path).unwrap();
        let spec = reader.spec();
        assert_eq!(spec.sample_rate, sample_rate);
        assert_eq!(spec.channels, 1);
        assert_eq!(spec.bits_per_sample, 16);
        assert_eq!(spec.sample_format, SampleFormat::Int);

        let read_samples: Vec<i16> = reader.into_samples::<i16>().map(|s| s.unwrap()).collect();
        assert_eq!(read_samples.len(), samples.len());

        // Verify audio has meaningful amplitude (not silent)
        let max_abs = read_samples.iter().map(|s| s.unsigned_abs()).max().unwrap();
        assert!(max_abs > 10000, "Expected loud audio, got max_abs={max_abs}");
    }

    #[test]
    fn wav_encoder_silent_audio_is_zero() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("silent.wav");

        let samples = vec![0.0f32; 48000];
        let mut enc = WavEncoder::new(&path, 48000, 1).unwrap();
        enc.write_f32_samples(&samples).unwrap();
        enc.finalize().unwrap();

        let reader = hound::WavReader::open(&path).unwrap();
        let read_samples: Vec<i16> = reader.into_samples::<i16>().map(|s| s.unwrap()).collect();
        let max_abs = read_samples.iter().map(|s| s.unsigned_abs()).max().unwrap();
        assert_eq!(max_abs, 0, "Silent input should produce zero samples");
    }
}
