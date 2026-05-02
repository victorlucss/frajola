//! Lightweight process-memory probe for the title-bar memory pill.
//!
//! Returns RSS in bytes for the current process. Implemented per-platform
//! without pulling in a new crate dependency: `ps -o rss=` everywhere POSIX,
//! a Windows API call via the existing `windows` dependency family if needed.
//!
//! `ps` is invoked through a child process so it MUST run inside
//! `spawn_blocking` (it's slow on the order of milliseconds).

/// Returns the resident-set size of the current process in bytes.
/// `0` on failure (caller can decide whether to surface or hide the pill).
pub fn current_rss_bytes() -> u64 {
    rss_via_ps().unwrap_or(0)
}

#[cfg(any(target_os = "macos", target_os = "linux"))]
fn rss_via_ps() -> Option<u64> {
    use std::process::Command;
    let pid = std::process::id().to_string();
    let output = Command::new("ps")
        .args(["-o", "rss=", "-p", &pid])
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let s = String::from_utf8_lossy(&output.stdout);
    let kb: u64 = s.trim().parse().ok()?;
    Some(kb.saturating_mul(1024))
}

#[cfg(not(any(target_os = "macos", target_os = "linux")))]
fn rss_via_ps() -> Option<u64> {
    // Windows fallback: not worth adding the windows crate just for this;
    // the pill simply hides on platforms we don't probe.
    None
}
