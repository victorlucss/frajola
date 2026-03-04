use std::process::Command;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use tauri::Emitter;
use tokio::time::sleep;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum MeetingSource {
    #[serde(rename = "native")]
    Native,
    #[serde(rename = "browser")]
    Browser,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct DetectedMeeting {
    pub app_name: String,
    pub source: MeetingSource,
}

#[derive(Debug, Clone, Serialize)]
pub struct MeetingDetectionEvent {
    pub meetings: Vec<DetectedMeeting>,
}

/// Polls every 5 seconds for active meetings and emits events on change.
pub async fn start_detection_loop(app: tauri::AppHandle) {
    let mut previous: Vec<DetectedMeeting> = Vec::new();

    loop {
        sleep(Duration::from_secs(5)).await;

        let mut meetings = Vec::new();

        if let Ok(native) = detect_native_apps() {
            meetings.extend(native);
        }
        if let Ok(browser) = detect_browser_meetings() {
            meetings.extend(browser);
        }

        // Sort for stable comparison
        meetings.sort_by(|a, b| a.app_name.cmp(&b.app_name));

        if meetings != previous {
            let _ = app.emit(
                "meeting-detection-changed",
                MeetingDetectionEvent {
                    meetings: meetings.clone(),
                },
            );

            previous = meetings;
        }
    }
}

/// Detect native meeting apps via `ps -eo comm`.
fn detect_native_apps() -> Result<Vec<DetectedMeeting>, String> {
    let output = Command::new("ps")
        .args(["-eo", "comm"])
        .output()
        .map_err(|e| e.to_string())?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut meetings = Vec::new();

    for line in stdout.lines() {
        let name = line.trim();
        // CptHost is Zoom's active-meeting process (not just the app being open)
        if name.ends_with("CptHost") {
            meetings.push(DetectedMeeting {
                app_name: "Zoom".into(),
                source: MeetingSource::Native,
            });
        } else if name.contains("MSTeams") || name.contains("Microsoft Teams") {
            meetings.push(DetectedMeeting {
                app_name: "Microsoft Teams".into(),
                source: MeetingSource::Native,
            });
        }
    }

    meetings.dedup_by(|a, b| a.app_name == b.app_name);
    Ok(meetings)
}

/// Detect browser-based meetings via AppleScript tab URL inspection.
fn detect_browser_meetings() -> Result<Vec<DetectedMeeting>, String> {
    let mut meetings = Vec::new();

    let browsers = [
        ("Google Chrome", "Google Chrome"),
        ("Microsoft Edge", "Microsoft Edge"),
        ("Safari", "Safari"),
    ];

    for (process_name, browser_name) in &browsers {
        if !is_process_running(process_name) {
            continue;
        }

        let urls = get_browser_tab_urls(browser_name);
        for url in &urls {
            if url.contains("meet.google.com/") && !url.contains("meet.google.com/landing") {
                meetings.push(DetectedMeeting {
                    app_name: "Google Meet".into(),
                    source: MeetingSource::Browser,
                });
            } else if url.contains("teams.microsoft.com") && url.contains("meeting") {
                meetings.push(DetectedMeeting {
                    app_name: "Teams (web)".into(),
                    source: MeetingSource::Browser,
                });
            } else if url.contains("zoom.us/j/") || url.contains("zoom.us/wc/") {
                meetings.push(DetectedMeeting {
                    app_name: "Zoom (web)".into(),
                    source: MeetingSource::Browser,
                });
            } else if url.contains("app.slack.com/huddle") {
                meetings.push(DetectedMeeting {
                    app_name: "Slack Huddle".into(),
                    source: MeetingSource::Browser,
                });
            }
        }
    }

    meetings.dedup_by(|a, b| a.app_name == b.app_name);
    Ok(meetings)
}

/// Check if a process is running via System Events (avoids launching the app).
fn is_process_running(name: &str) -> bool {
    let script = format!(
        r#"tell application "System Events" to (name of processes) contains "{}""#,
        name
    );
    let output = Command::new("osascript")
        .args(["-e", &script])
        .output();

    match output {
        Ok(o) => String::from_utf8_lossy(&o.stdout).trim() == "true",
        Err(_) => false,
    }
}

/// Get all tab URLs from a browser via AppleScript.
fn get_browser_tab_urls(browser: &str) -> Vec<String> {
    let script = if browser == "Safari" {
        format!(
            r#"tell application "{browser}"
    set urls to {{}}
    repeat with w in windows
        repeat with t in tabs of w
            set end of urls to URL of t
        end repeat
    end repeat
    return urls
end tell"#
        )
    } else {
        // Chrome-based browsers
        format!(
            r#"tell application "{browser}"
    set urls to {{}}
    repeat with w in windows
        repeat with t in tabs of w
            set end of urls to URL of t
        end repeat
    end repeat
    return urls
end tell"#
        )
    };

    let output = Command::new("osascript")
        .args(["-e", &script])
        .output();

    match output {
        Ok(o) if o.status.success() => {
            let stdout = String::from_utf8_lossy(&o.stdout);
            stdout
                .split(", ")
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
                .collect()
        }
        _ => Vec::new(),
    }
}
