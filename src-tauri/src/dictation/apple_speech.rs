/// Apple Speech recognition bridge (macOS only)
/// Links to a Swift static library via C FFI.
///
/// Lifetime model
/// --------------
/// The `CallbackBox` holding the Rust closures is heap-allocated via `Box::leak`
/// at `start()` and its pointer is stashed in `ACTIVE_CONTEXT`.
///
/// Trampolines validate `ACTIVE_CONTEXT == context` before dereferencing — this is
/// cheap (single atomic load) and safe on the audio thread, which fires the level
/// callback up to ~43 Hz.
///
/// The tricky part is freeing the box without creating a UAF when the user
/// quickly stops and starts again. Rules:
///   * `stop()` schedules a delayed free for the *specific* ctx that was active
///     at the moment of stop. It uses `compare_exchange`, so a restart that has
///     already swapped in a new ctx won't be clobbered.
///   * `start()` aggressively reclaims any leftover box from a previous session
///     (which can happen if we restart mid-delay). Because the Swift bridge has
///     already been asked to stop via `dict_speech_stop` and its `startRecognition`
///     calls `removeTap(onBus: 0)` + `audioEngine.stop()` which synchronously tear
///     down the prior tap, and its recognition task uses a `sessionID` guard to
///     drop late results — so no live callback still holds the old ctx once
///     `dict_speech_start` returns.
///   * `cancel()` behaves like `stop()` but with a short tail (100 ms) since
///     the Swift side doesn't sit on a 3 s final-result timer when cancelling.
use std::ffi::{CStr, CString};
use std::os::raw::{c_char, c_void};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Mutex;
use std::time::Duration;

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

// Atomic for fast lock-free validation in the hot path (level callbacks ~43/sec).
static ACTIVE_CONTEXT: AtomicUsize = AtomicUsize::new(0);
// Mutex serialises all lifecycle operations (start / stop-free / cancel-free).
// Trampolines NEVER take this lock — they only touch ACTIVE_CONTEXT.
static LIFECYCLE_LOCK: Mutex<()> = Mutex::new(());

// How long to wait after `stop()` before freeing the box. Must exceed the Swift
// bridge's 3 s final-result timeout so late results can still trampoline safely.
const STOP_FREE_DELAY: Duration = Duration::from_secs(4);
// Much shorter for cancel — Swift tears down synchronously, we just drain any
// in-flight audio-thread callback.
const CANCEL_FREE_DELAY: Duration = Duration::from_millis(150);

/// Start Apple Speech recognition with the given language code.
pub fn start(language: &str, callbacks: SpeechCallbacks) {
    let cb_box = Box::new(CallbackBox { callbacks });
    let ctx = Box::into_raw(cb_box) as *mut c_void;

    // Serialise against concurrent stop/cancel that might also want to free.
    let lock = LIFECYCLE_LOCK.lock().expect("lifecycle lock poisoned");

    // If a previous session's box is still allocated (delayed free hasn't fired),
    // reclaim it now. Safe because: (a) Swift's `startRecognition` bumps its
    // internal sessionID, so old recognition-task callbacks are filtered out,
    // and (b) it calls `removeTap(onBus: 0)` + `audioEngine.stop()` before
    // installing the new tap, so no audio-thread callback is in flight.
    let old = ACTIVE_CONTEXT.swap(ctx as usize, Ordering::AcqRel);
    if old != 0 {
        unsafe {
            let _ = Box::from_raw(old as *mut CallbackBox);
        }
    }

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

    drop(lock);
}

/// Stop recognition (allows Swift's final-result timeout to run out).
pub fn stop() {
    let ctx_to_free = ACTIVE_CONTEXT.load(Ordering::Acquire);
    unsafe {
        dict_speech_stop();
    }
    schedule_delayed_free(ctx_to_free, STOP_FREE_DELAY);
}

/// Cancel recognition immediately.
pub fn cancel() {
    let ctx_to_free = ACTIVE_CONTEXT.load(Ordering::Acquire);
    unsafe {
        dict_speech_cancel();
    }
    schedule_delayed_free(ctx_to_free, CANCEL_FREE_DELAY);
}

fn schedule_delayed_free(ctx: usize, delay: Duration) {
    if ctx == 0 {
        return;
    }
    std::thread::spawn(move || {
        std::thread::sleep(delay);
        try_free_if_still_active(ctx);
    });
}

/// Free the box only if ACTIVE_CONTEXT is still pointing at it. If a newer
/// session has already taken over, the new session owns the lifecycle now.
fn try_free_if_still_active(ctx: usize) {
    let _lock = LIFECYCLE_LOCK.lock().expect("lifecycle lock poisoned");
    if ACTIVE_CONTEXT
        .compare_exchange(ctx, 0, Ordering::AcqRel, Ordering::Acquire)
        .is_ok()
    {
        unsafe {
            let _ = Box::from_raw(ctx as *mut CallbackBox);
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
    let text_str = unsafe { CStr::from_ptr(text) }.to_str().unwrap_or("");
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU32, Ordering};
    use std::sync::Arc;

    /// Build a CallbackBox that increments a counter each time its on_level fires.
    /// Returns a raw pointer (the box is leaked; caller is responsible for `Box::from_raw`).
    fn leak_counting_box(counter: Arc<AtomicU32>) -> *mut c_void {
        let cb_box = Box::new(CallbackBox {
            callbacks: SpeechCallbacks {
                on_result: Box::new(|_, _| {}),
                on_level: Box::new(move |_| {
                    counter.fetch_add(1, Ordering::Relaxed);
                }),
                on_error: Box::new(|_| {}),
            },
        });
        Box::into_raw(cb_box) as *mut c_void
    }

    /// Serial guard: the tests touch global `ACTIVE_CONTEXT`, so they cannot
    /// safely interleave even though each individual test cleans up.
    fn serial_guard() -> std::sync::MutexGuard<'static, ()> {
        static GUARD: Mutex<()> = Mutex::new(());
        // Intentionally unpoisoning; tests don't care about poisoning semantics.
        GUARD.lock().unwrap_or_else(|p| p.into_inner())
    }

    fn reset_active() {
        let old = ACTIVE_CONTEXT.swap(0, Ordering::AcqRel);
        if old != 0 {
            unsafe {
                let _ = Box::from_raw(old as *mut CallbackBox);
            }
        }
    }

    #[test]
    fn trampoline_dispatches_level_when_context_active() {
        let _g = serial_guard();
        reset_active();

        let counter = Arc::new(AtomicU32::new(0));
        let ctx = leak_counting_box(counter.clone());
        ACTIVE_CONTEXT.store(ctx as usize, Ordering::Release);

        on_level_trampoline(ctx, 0.42);
        on_level_trampoline(ctx, 0.43);

        assert_eq!(counter.load(Ordering::Relaxed), 2);

        reset_active();
    }

    #[test]
    fn trampoline_ignores_stale_context() {
        let _g = serial_guard();
        reset_active();

        let counter_a = Arc::new(AtomicU32::new(0));
        let ctx_a = leak_counting_box(counter_a.clone());

        let counter_b = Arc::new(AtomicU32::new(0));
        let ctx_b = leak_counting_box(counter_b.clone());

        // Mark ctx_b as active — any callback bearing ctx_a must be dropped.
        ACTIVE_CONTEXT.store(ctx_b as usize, Ordering::Release);

        on_level_trampoline(ctx_a, 1.0);

        assert_eq!(counter_a.load(Ordering::Relaxed), 0);
        assert_eq!(counter_b.load(Ordering::Relaxed), 0);

        // Now dispatch for ctx_b — should fire.
        on_level_trampoline(ctx_b, 1.0);
        assert_eq!(counter_b.load(Ordering::Relaxed), 1);

        // Clean up manually: ctx_a was never installed, ctx_b is the active one.
        unsafe {
            let _ = Box::from_raw(ctx_a as *mut CallbackBox);
        }
        reset_active(); // frees ctx_b
    }

    #[test]
    fn try_free_no_ops_if_context_replaced() {
        let _g = serial_guard();
        reset_active();

        let counter_a = Arc::new(AtomicU32::new(0));
        let ctx_a = leak_counting_box(counter_a.clone());

        let counter_b = Arc::new(AtomicU32::new(0));
        let ctx_b = leak_counting_box(counter_b.clone());

        // Active is ctx_b; stop for ctx_a fires late and must not clobber.
        ACTIVE_CONTEXT.store(ctx_b as usize, Ordering::Release);

        try_free_if_still_active(ctx_a as usize);

        // ctx_b is still active, ctx_a is still allocated (but not owned here).
        assert_eq!(
            ACTIVE_CONTEXT.load(Ordering::Acquire),
            ctx_b as usize
        );

        unsafe {
            let _ = Box::from_raw(ctx_a as *mut CallbackBox);
        }
        reset_active();
    }

    #[test]
    fn try_free_clears_active_when_match() {
        let _g = serial_guard();
        reset_active();

        let counter = Arc::new(AtomicU32::new(0));
        let ctx = leak_counting_box(counter.clone());
        ACTIVE_CONTEXT.store(ctx as usize, Ordering::Release);

        try_free_if_still_active(ctx as usize);

        assert_eq!(ACTIVE_CONTEXT.load(Ordering::Acquire), 0);
    }

    #[test]
    fn null_context_does_not_crash() {
        // Pure safety test — the trampolines early-return on null without touching
        // ACTIVE_CONTEXT, so no global state is needed.
        on_result_trampoline(std::ptr::null_mut(), std::ptr::null(), false);
        on_level_trampoline(std::ptr::null_mut(), 0.0);
        on_error_trampoline(std::ptr::null_mut(), std::ptr::null());
    }
}
