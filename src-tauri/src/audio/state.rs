use std::path::PathBuf;
use std::sync::atomic::AtomicBool;
use std::sync::{Arc, Mutex};
use std::thread::JoinHandle;
use std::time::Instant;

use cpal::Stream;

pub struct RecordingState {
    pub active: Mutex<Option<ActiveRecording>>,
}

pub struct ActiveRecording {
    pub meeting_id: i64,
    pub audio_path: PathBuf,
    pub started_at: Instant,
    pub stop_flag: Arc<AtomicBool>,
    pub paused_flag: Arc<AtomicBool>,
    pub silence_warning: Arc<AtomicBool>,
    pub writer_thread: Option<JoinHandle<Result<(), String>>>,
    pub _mic_stream: Option<Stream>,
    pub _system_stream: Option<Stream>,
}
