use arboard::Clipboard;
use enigo::{Direction, Enigo, Key, Keyboard, Settings as EnigoSettings};
use std::thread;
use std::time::Duration;

/// Dispatch a closure synchronously to the main thread on macOS.
/// If already on the main thread, runs directly.
/// On non-macOS, runs directly (assumes caller is on an appropriate thread).
#[cfg(target_os = "macos")]
fn on_main_thread_sync<F: FnOnce() + Send>(f: F) {
    use std::ffi::c_void;

    extern "C" {
        fn pthread_main_np() -> i32;
        static _dispatch_main_q: c_void;
        fn dispatch_sync_f(
            queue: *const c_void,
            context: *mut c_void,
            work: extern "C" fn(*mut c_void),
        );
    }

    if unsafe { pthread_main_np() } == 1 {
        f();
    } else {
        struct Ctx<F: FnOnce()> {
            f: Option<F>,
        }

        extern "C" fn trampoline<F: FnOnce()>(ctx: *mut c_void) {
            let ctx = unsafe { &mut *(ctx as *mut Ctx<F>) };
            if let Some(f) = ctx.f.take() {
                f();
            }
        }

        let mut ctx = Ctx { f: Some(f) };
        unsafe {
            dispatch_sync_f(
                &_dispatch_main_q as *const c_void,
                &mut ctx as *mut Ctx<F> as *mut c_void,
                trampoline::<F>,
            );
        }
    }
}

#[cfg(not(target_os = "macos"))]
fn on_main_thread_sync<F: FnOnce() + Send>(f: F) {
    f();
}

/// Inject text into the focused application via clipboard paste.
/// Returns false if Accessibility permission is missing (caller should alert user).
pub fn inject_text(text: &str, flow_mode: bool) -> bool {
    // Check Accessibility permission before attempting paste
    #[cfg(target_os = "macos")]
    if !check_accessibility() {
        log::error!("Cannot paste: Accessibility permission not granted");
        return false;
    }

    // Small delay to ensure the target app has focus after overlay dismissal
    thread::sleep(Duration::from_millis(100));

    let mut clipboard = match Clipboard::new() {
        Ok(c) => c,
        Err(e) => {
            log::error!("Failed to access clipboard: {}", e);
            return false;
        }
    };

    // Save previous clipboard contents
    let previous = clipboard.get_text().ok();

    // Set new text
    if let Err(e) = clipboard.set_text(text) {
        log::error!("Failed to set clipboard text: {}", e);
        return false;
    }

    log::info!("Pasting text (flow mode: {})", flow_mode);

    // Simulate paste shortcut — must run on main thread (HIToolbox requirement)
    on_main_thread_sync(simulate_paste);

    // Flow mode: press Enter after pasting to send the message
    if flow_mode {
        thread::sleep(Duration::from_millis(300));
        on_main_thread_sync(simulate_enter);
    }

    // Restore clipboard after a delay
    let restore_delay = if flow_mode { 1000 } else { 500 };
    let prev = previous.clone();
    thread::spawn(move || {
        thread::sleep(Duration::from_millis(restore_delay));
        if let Ok(mut cb) = Clipboard::new() {
            cb.clear().ok();
            if let Some(text) = prev {
                cb.set_text(text).ok();
            }
        }
    });

    true
}

/// Simulate Cmd+V (macOS) or Ctrl+V (Windows/Linux)
fn simulate_paste() {
    let mut enigo = match Enigo::new(&EnigoSettings::default()) {
        Ok(e) => e,
        Err(e) => {
            log::error!("Failed to create enigo: {}", e);
            return;
        }
    };

    let modifier = if cfg!(target_os = "macos") {
        Key::Meta
    } else {
        Key::Control
    };

    enigo.key(modifier, Direction::Press).ok();
    enigo.key(Key::Unicode('v'), Direction::Click).ok();
    enigo.key(modifier, Direction::Release).ok();
}

/// Simulate Enter key press
fn simulate_enter() {
    let mut enigo = match Enigo::new(&EnigoSettings::default()) {
        Ok(e) => e,
        Err(e) => {
            log::error!("Failed to create enigo for Enter: {}", e);
            return;
        }
    };

    enigo.key(Key::Return, Direction::Click).ok();
    log::info!("Flow mode: Enter sent");
}

/// Simulate a keyboard shortcut from a combo string like "cmd+shift+3"
pub fn simulate_key_combo(combo: &str) {
    thread::sleep(Duration::from_millis(100));

    let combo_owned = combo.to_string();
    on_main_thread_sync(move || {
        simulate_key_combo_inner(&combo_owned);
    });
}

fn simulate_key_combo_inner(combo: &str) {
    let mut enigo = match Enigo::new(&EnigoSettings::default()) {
        Ok(e) => e,
        Err(e) => {
            log::error!("Failed to create enigo for key combo: {}", e);
            return;
        }
    };

    let lowered = combo.to_lowercase();
    let parts_owned: Vec<String> = lowered.split('+').map(|s| s.trim().to_string()).collect();

    if parts_owned.is_empty() {
        log::warn!("Invalid key combo: {}", combo);
        return;
    }

    // Press modifiers
    let modifiers: Vec<Key> = parts_owned[..parts_owned.len() - 1]
        .iter()
        .filter_map(|part| match part.as_str() {
            "cmd" | "command" => Some(if cfg!(target_os = "macos") {
                Key::Meta
            } else {
                Key::Control
            }),
            "shift" => Some(Key::Shift),
            "opt" | "option" | "alt" => Some(Key::Alt),
            "ctrl" | "control" => Some(Key::Control),
            other => {
                log::warn!("Unknown modifier: {}", other);
                None
            }
        })
        .collect();

    let key_name = &parts_owned[parts_owned.len() - 1];
    let key = match key_name.as_str() {
        "return" | "enter" => Key::Return,
        "tab" => Key::Tab,
        "space" => Key::Unicode(' '),
        "delete" | "backspace" => Key::Backspace,
        "escape" | "esc" => Key::Escape,
        "up" => Key::UpArrow,
        "down" => Key::DownArrow,
        "left" => Key::LeftArrow,
        "right" => Key::RightArrow,
        s if s.len() == 1 => Key::Unicode(s.chars().next().unwrap()),
        other => {
            log::warn!("Unknown key name: {}", other);
            return;
        }
    };

    // Press all modifiers
    for m in &modifiers {
        enigo.key(*m, Direction::Press).ok();
    }

    // Press and release the main key
    enigo.key(key, Direction::Click).ok();

    // Release modifiers in reverse
    for m in modifiers.iter().rev() {
        enigo.key(*m, Direction::Release).ok();
    }

    log::info!("Simulated key combo: {}", combo);
}

/// Parse a key combo string into its parts for validation.
pub fn parse_key_combo(combo: &str) -> Option<(Vec<String>, String)> {
    let trimmed = combo.trim();
    if trimmed.is_empty() {
        return None;
    }
    let lowered = trimmed.to_lowercase();
    let parts: Vec<String> = lowered.split('+').map(|s| s.trim().to_string()).collect();
    if parts.is_empty() {
        return None;
    }
    let key = parts.last()?.clone();
    let modifiers = parts[..parts.len() - 1].to_vec();
    Some((modifiers, key))
}

/// Check Accessibility permission status (macOS only)
#[cfg(target_os = "macos")]
pub fn check_accessibility() -> bool {
    extern "C" {
        fn AXIsProcessTrusted() -> bool;
    }
    unsafe { AXIsProcessTrusted() }
}

#[cfg(not(target_os = "macos"))]
pub fn check_accessibility() -> bool {
    true
}

/// Open macOS Accessibility settings page.
pub fn open_accessibility_settings() {
    #[cfg(target_os = "macos")]
    {
        let _ = std::process::Command::new("open")
            .arg("x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility")
            .spawn();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_key_combo_simple() {
        let (mods, key) = parse_key_combo("cmd+v").unwrap();
        assert_eq!(mods, vec!["cmd"]);
        assert_eq!(key, "v");
    }

    #[test]
    fn test_parse_key_combo_multiple_mods() {
        let (mods, key) = parse_key_combo("cmd+shift+3").unwrap();
        assert_eq!(mods, vec!["cmd", "shift"]);
        assert_eq!(key, "3");
    }

    #[test]
    fn test_parse_key_combo_single_key() {
        let (mods, key) = parse_key_combo("return").unwrap();
        assert!(mods.is_empty());
        assert_eq!(key, "return");
    }

    #[test]
    fn test_parse_key_combo_case_insensitive() {
        let (mods, key) = parse_key_combo("Cmd+Shift+A").unwrap();
        assert_eq!(mods, vec!["cmd", "shift"]);
        assert_eq!(key, "a");
    }

    #[test]
    fn test_parse_key_combo_empty() {
        assert!(parse_key_combo("").is_none());
    }
}
