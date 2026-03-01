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
