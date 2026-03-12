use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

use cpal::Stream;

/// Whether the dictation hotkey operates as toggle or push-to-talk.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum HotkeyMode {
    Toggle,
    PushToTalk,
}

impl HotkeyMode {
    pub fn from_str(s: &str) -> Self {
        match s {
            "push_to_talk" | "pushToTalk" => Self::PushToTalk,
            _ => Self::Toggle,
        }
    }
}

/// Which STT engine to use for dictation.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum SttEngine {
    Apple,
    Whisper,
}

impl SttEngine {
    pub fn from_str(s: &str) -> Self {
        match s {
            "apple" => Self::Apple,
            _ => Self::Whisper,
        }
    }
}

/// Runtime state for an active dictation session.
pub struct ActiveDictation {
    pub stop_flag: Arc<AtomicBool>,
    pub mic_stream: Option<Stream>,
    pub audio_path: Option<std::path::PathBuf>,
    pub engine: SttEngine,
}

/// Managed state for the dictation subsystem.
pub struct DictationState {
    pub active: Mutex<Option<ActiveDictation>>,
}

impl DictationState {
    pub fn new() -> Self {
        Self {
            active: Mutex::new(None),
        }
    }

    pub fn is_active(&self) -> bool {
        self.active
            .lock()
            .map(|lock| lock.is_some())
            .unwrap_or(false)
    }

    pub fn stop(&self) {
        if let Ok(mut lock) = self.active.lock() {
            if let Some(active) = lock.as_ref() {
                active.stop_flag.store(true, Ordering::Relaxed);
            }
            // Drop streams and state
            let _ = lock.take();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hotkey_mode_from_str() {
        assert_eq!(HotkeyMode::from_str("toggle"), HotkeyMode::Toggle);
        assert_eq!(HotkeyMode::from_str("push_to_talk"), HotkeyMode::PushToTalk);
        assert_eq!(HotkeyMode::from_str("pushToTalk"), HotkeyMode::PushToTalk);
        assert_eq!(HotkeyMode::from_str("unknown"), HotkeyMode::Toggle);
    }

    #[test]
    fn test_stt_engine_from_str() {
        assert_eq!(SttEngine::from_str("apple"), SttEngine::Apple);
        assert_eq!(SttEngine::from_str("whisper"), SttEngine::Whisper);
        assert_eq!(SttEngine::from_str("unknown"), SttEngine::Whisper);
    }

    #[test]
    fn test_dictation_state_lifecycle() {
        let state = DictationState::new();
        assert!(!state.is_active());

        // Simulate starting dictation
        {
            let mut lock = state.active.lock().unwrap();
            *lock = Some(ActiveDictation {
                stop_flag: Arc::new(AtomicBool::new(false)),
                mic_stream: None,
                audio_path: None,
                engine: SttEngine::Whisper,
            });
        }
        assert!(state.is_active());

        // Simulate stopping dictation
        state.stop();
        assert!(!state.is_active());
    }
}
