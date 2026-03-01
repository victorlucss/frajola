use std::path::Path;

use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters};

use crate::error::AppError;

#[derive(Debug)]
pub struct Segment {
    pub start_ms: i64,
    pub end_ms: i64,
    pub text: String,
    pub speaker: Option<String>,
}

/// Run Whisper inference on 16kHz mono f32 audio samples.
pub fn transcribe(
    model_path: &Path,
    samples_16k: &[f32],
    language: Option<&str>,
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

    if let Some(lang) = language {
        params.set_language(Some(lang));
    } else {
        params.set_language(Some("en"));
    }

    params.set_tdrz_enable(true);
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

        let speaker_label = format!("Speaker {current_speaker}");

        // Check if the *next* segment is a different speaker
        let is_turn = state.full_get_segment_speaker_turn_next(i);

        segments.push(Segment {
            start_ms: start_cs * 10, // centiseconds → milliseconds
            end_ms: end_cs * 10,
            text: trimmed,
            speaker: Some(speaker_label),
        });

        if is_turn {
            current_speaker += 1;
        }
    }

    Ok(segments)
}
