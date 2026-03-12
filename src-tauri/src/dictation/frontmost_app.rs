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
    use std::ffi::OsString;
    use std::os::windows::ffi::OsStringExt;

    unsafe {
        let hwnd = windows::Win32::UI::WindowsAndMessaging::GetForegroundWindow();
        if hwnd.0.is_null() {
            return "Unknown".to_string();
        }

        let mut title = [0u16; 256];
        let len = windows::Win32::UI::WindowsAndMessaging::GetWindowTextW(hwnd, &mut title);
        if len > 0 {
            let os_str = OsString::from_wide(&title[..len as usize]);
            return os_str.to_string_lossy().into_owned();
        }
    }
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
