/// Get the name of the currently focused application.

#[cfg(target_os = "macos")]
pub fn get_frontmost_app() -> String {
    use objc2_app_kit::NSWorkspace;

    let workspace = NSWorkspace::sharedWorkspace();
    if let Some(app) = workspace.frontmostApplication() {
        if let Some(name) = app.localizedName() {
            return name.to_string();
        }
    }
    "Unknown".to_string()
}

#[cfg(target_os = "windows")]
pub fn get_frontmost_app() -> String {
    // The previous implementation referenced the `windows` crate but it was
    // never declared in Cargo.toml. Until the Win32 frontmost-app probe is
    // properly added back (tracked separately), Windows reports "Unknown" so
    // the LLM prompt-builder still gets a valid string.
    "Unknown".to_string()
}

#[cfg(target_os = "linux")]
pub fn get_frontmost_app() -> String {
    if let Ok(output) = std::process::Command::new("xdotool")
        .args(["getactivewindow", "getwindowname"])
        .output()
    {
        if output.status.success() {
            let name = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !name.is_empty() {
                return name;
            }
        }
    }
    "Unknown".to_string()
}

#[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
pub fn get_frontmost_app() -> String {
    "Unknown".to_string()
}
