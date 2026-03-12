/// Apple Speech recognition bridge (macOS only)
/// Links to a Swift static library via C FFI.
use std::ffi::{CStr, CString};
use std::os::raw::{c_char, c_void};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Mutex;

extern "C" {
    fn dict_speech_set_callbacks(
        context: *mut c_void,
        on_result: Option<
            extern "C" fn(context: *mut c_void, text: *const c_char, is_final: bool),
        >,
        on_level: Option<extern "C" fn(context: *mut c_void, level: f32)>,
        on_error: Option<extern "C" fn(context: *mut c_void, error: *const c_char)>,
    );
    fn dict_speech_start(language: *const c_char);
    fn dict_speech_stop();
    fn dict_speech_cancel();
    fn dict_speech_request_permissions(callback: extern "C" fn(bool, bool));
}

/// Request microphone and speech recognition permissions.
pub fn request_permissions() {
    unsafe {
        dict_speech_request_permissions(permission_callback);
    }
}

extern "C" fn permission_callback(speech_granted: bool, mic_granted: bool) {
    log::info!(
        "Permissions — mic: {}, speech: {}",
        if mic_granted { "granted" } else { "denied" },
        if speech_granted { "granted" } else { "denied" }
    );
    if !mic_granted {
        log::error!("Microphone permission denied! Speech recognition will not work.");
    }
    if !speech_granted {
        log::error!("Speech recognition permission denied!");
    }
}

/// Callbacks that the Rust side uses to receive speech events.
pub struct SpeechCallbacks {
    pub on_result: Box<dyn Fn(&str, bool) + Send + 'static>,
    pub on_level: Box<dyn Fn(f32) + Send + 'static>,
    pub on_error: Box<dyn Fn(&str) + Send + 'static>,
}

struct CallbackBox {
    callbacks: SpeechCallbacks,
}

// Atomic for fast lock-free validation in hot-path (level callbacks ~43/sec)
static ACTIVE_CONTEXT: AtomicUsize = AtomicUsize::new(0);
// Mutex only used for freeing the context (rare operation)
static CONTEXT_FREE_LOCK: Mutex<()> = Mutex::new(());

/// Start Apple Speech recognition with the given language code.
pub fn start(language: &str, callbacks: SpeechCallbacks) {
    let cb_box = Box::new(CallbackBox { callbacks });
    let ctx = Box::into_raw(cb_box) as *mut c_void;

    // Store context BEFORE calling into Swift (which dispatches to main async)
    ACTIVE_CONTEXT.store(ctx as usize, Ordering::Release);

    unsafe {
        dict_speech_set_callbacks(
            ctx,
            Some(on_result_trampoline),
            Some(on_level_trampoline),
            Some(on_error_trampoline),
        );

        let lang = CString::new(language).unwrap_or_else(|_| CString::new("en").unwrap());
        dict_speech_start(lang.as_ptr());
    }
}

/// Stop recognition (allows final result to arrive via 3s timeout).
pub fn stop() {
    unsafe {
        dict_speech_stop();
    }
    // Free context after a delay longer than the Swift bridge's 3s timeout,
    // to ensure no more callbacks arrive after freeing.
    std::thread::spawn(|| {
        std::thread::sleep(std::time::Duration::from_secs(4));
        free_context();
    });
}

/// Cancel recognition immediately.
pub fn cancel() {
    unsafe {
        dict_speech_cancel();
    }
    // Small delay to let any in-flight callbacks drain before freeing
    std::thread::spawn(|| {
        std::thread::sleep(std::time::Duration::from_millis(100));
        free_context();
    });
}

fn free_context() {
    let _lock = CONTEXT_FREE_LOCK.lock().unwrap();
    let ptr = ACTIVE_CONTEXT.swap(0, Ordering::AcqRel);
    if ptr != 0 {
        unsafe {
            let _ = Box::from_raw(ptr as *mut CallbackBox);
        }
    }
}

extern "C" fn on_result_trampoline(context: *mut c_void, text: *const c_char, is_final: bool) {
    if context.is_null() || text.is_null() {
        return;
    }
    if ACTIVE_CONTEXT.load(Ordering::Acquire) != context as usize {
        return;
    }
    let cb_box = unsafe { &*(context as *const CallbackBox) };
    let text_str = unsafe { CStr::from_ptr(text) }
        .to_str()
        .unwrap_or("");
    (cb_box.callbacks.on_result)(text_str, is_final);
}

extern "C" fn on_level_trampoline(context: *mut c_void, level: f32) {
    if context.is_null() {
        return;
    }
    if ACTIVE_CONTEXT.load(Ordering::Acquire) != context as usize {
        return;
    }
    let cb_box = unsafe { &*(context as *const CallbackBox) };
    (cb_box.callbacks.on_level)(level);
}

extern "C" fn on_error_trampoline(context: *mut c_void, error: *const c_char) {
    if context.is_null() || error.is_null() {
        return;
    }
    if ACTIVE_CONTEXT.load(Ordering::Acquire) != context as usize {
        return;
    }
    let cb_box = unsafe { &*(context as *const CallbackBox) };
    let error_str = unsafe { CStr::from_ptr(error) }
        .to_str()
        .unwrap_or("Unknown error");
    (cb_box.callbacks.on_error)(error_str);
}
