use std::process::Command;

use futures_util::StreamExt;
use serde::Serialize;
use tauri::{AppHandle, Emitter, State};

use crate::ai;
use crate::ai::ollama::{OllamaClient, OllamaStatus};
use crate::db::Database;
use crate::error::AppError;

#[derive(Debug, Serialize, Clone)]
pub struct SummarizationEvent {
    pub meeting_id: i64,
}

#[derive(Debug, Serialize)]
pub struct OllamaInstallResult {
    pub installed: bool,
    pub requires_manual: bool,
    pub message: String,
}

/// Core summarization logic, callable from other commands.
pub async fn run_summarization(
    app: &AppHandle,
    db: &Database,
    meeting_id: i64,
) -> Result<(), AppError> {
    // 1. Set status to 'summarizing'
    db.update_meeting_status(meeting_id, "summarizing")?;
    let _ = app.emit(
        "summarization-started",
        SummarizationEvent { meeting_id },
    );

    // 2. Read transcript segments
    let segments = db.get_transcript_segments(meeting_id)?;
    if segments.is_empty() {
        log::warn!("No transcript segments for meeting {meeting_id}, skipping summarization");
        db.update_meeting_status(meeting_id, "complete")?;
        return Ok(());
    }

    // 3. Build transcript text
    let transcript_text: String = segments
        .iter()
        .map(|s| {
            if let Some(ref speaker) = s.speaker {
                format!("[{}] {}", speaker, s.content)
            } else {
                s.content.clone()
            }
        })
        .collect::<Vec<_>>()
        .join("\n");

    // 4. Get meeting language
    let meeting = db.get_meeting(meeting_id)?;
    let language = meeting
        .as_ref()
        .and_then(|m| m.language.as_deref())
        .unwrap_or("en");

    // 5. Call LLM — on failure, log and set complete (transcript is still valid)
    let result = ai::summarize(db, &transcript_text, language).await;

    match result {
        Ok((response, provider, model)) => {
            // 6. Update meeting title if LLM provided one
            if let Some(ref title) = response.title {
                if let Err(e) = db.update_meeting_title(meeting_id, title) {
                    log::error!("Failed to update meeting title for {meeting_id}: {e}");
                }
            }

            // 7. Insert summary
            let key_points_json = serde_json::to_string(&response.key_points)
                .unwrap_or_else(|_| "[]".to_string());
            let decisions_json = serde_json::to_string(&response.decisions)
                .unwrap_or_else(|_| "[]".to_string());

            if let Err(e) = db.insert_summary(
                meeting_id,
                &response.summary,
                &key_points_json,
                &decisions_json,
                &provider,
                &model,
            ) {
                log::error!("Failed to insert summary for meeting {meeting_id}: {e}");
            }

            // 7. Insert action items
            let items: Vec<(String, Option<String>)> = response
                .action_items
                .into_iter()
                .map(|a| (a.description, a.assignee))
                .collect();

            if !items.is_empty() {
                if let Err(e) = db.insert_action_items(meeting_id, &items) {
                    log::error!("Failed to insert action items for meeting {meeting_id}: {e}");
                }
            }
        }
        Err(e) => {
            log::warn!("Summarization failed for meeting {meeting_id}: {e}");
        }
    }

    // 8. Set status to 'complete' and emit event
    db.update_meeting_status(meeting_id, "complete")?;
    let _ = app.emit(
        "summarization-complete",
        SummarizationEvent { meeting_id },
    );

    Ok(())
}

/// Tauri command: full summarization pipeline.
#[tauri::command]
pub async fn summarize_meeting(
    app: AppHandle,
    db: State<'_, Database>,
    meeting_id: i64,
) -> Result<(), AppError> {
    run_summarization(&app, &db, meeting_id).await
}

/// Check if Ollama is running and list available models.
#[tauri::command]
pub async fn check_ollama_status() -> OllamaStatus {
    let client = OllamaClient::new(None);
    client.check_status().await
}

fn command_exists(cmd: &str) -> bool {
    #[cfg(target_os = "windows")]
    let check = Command::new("where").arg(cmd).output();
    #[cfg(not(target_os = "windows"))]
    let check = Command::new("which").arg(cmd).output();

    check.map(|o| o.status.success()).unwrap_or(false)
}

#[cfg(target_os = "macos")]
fn install_ollama_with_homebrew() -> OllamaInstallResult {
    if !command_exists("brew") {
        let _ = Command::new("open")
            .arg("https://ollama.com/download/mac")
            .spawn();
        return OllamaInstallResult {
            installed: false,
            requires_manual: true,
            message: "Homebrew not found. Opened Ollama macOS download page.".to_string(),
        };
    }

    let output = Command::new("brew")
        .args(["install", "--cask", "ollama"])
        .output();

    match output {
        Ok(out) if out.status.success() => {
            let _ = Command::new("open").args(["-a", "Ollama"]).spawn();
            OllamaInstallResult {
                installed: true,
                requires_manual: false,
                message: "Ollama installed via Homebrew and launched.".to_string(),
            }
        }
        Ok(out) => OllamaInstallResult {
            installed: command_exists("ollama"),
            requires_manual: true,
            message: format!(
                "Homebrew install failed: {}",
                String::from_utf8_lossy(&out.stderr)
            ),
        },
        Err(err) => OllamaInstallResult {
            installed: false,
            requires_manual: true,
            message: format!("Failed to execute Homebrew install: {err}"),
        },
    }
}

/// Install Ollama locally (best effort) and launch it.
#[tauri::command]
pub async fn install_ollama() -> Result<OllamaInstallResult, AppError> {
    tokio::task::spawn_blocking(|| {
        if command_exists("ollama") {
            #[cfg(target_os = "macos")]
            { let _ = Command::new("open").args(["-a", "Ollama"]).spawn(); }
            #[cfg(target_os = "windows")]
            { let _ = Command::new("cmd").args(["/C", "start", "", "ollama"]).spawn(); }
            #[cfg(target_os = "linux")]
            { let _ = Command::new("ollama").arg("serve").spawn(); }

            return OllamaInstallResult {
                installed: true,
                requires_manual: false,
                message: "Ollama already installed. Attempted to launch it.".to_string(),
            };
        }

        #[cfg(target_os = "macos")]
        {
            return install_ollama_with_homebrew();
        }

        #[cfg(not(target_os = "macos"))]
        {
            #[cfg(target_os = "windows")]
            { let _ = Command::new("cmd").args(["/C", "start", "", "https://ollama.com/download"]).spawn(); }
            #[cfg(target_os = "linux")]
            { let _ = Command::new("xdg-open").arg("https://ollama.com/download").spawn(); }

            OllamaInstallResult {
                installed: false,
                requires_manual: true,
                message: "Opened Ollama download page.".to_string(),
            }
        }
    })
    .await
    .map_err(|e| AppError::General(format!("Install task failed: {e}")))
}

/// Start Ollama if installed.
#[tauri::command]
pub fn start_ollama() -> Result<(), AppError> {
    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .args(["-a", "Ollama"])
            .spawn()
            .map_err(|e| AppError::General(format!("Failed to start Ollama: {e}")))?;
        return Ok(());
    }

    #[cfg(not(target_os = "macos"))]
    {
        Command::new("ollama")
            .arg("serve")
            .spawn()
            .map_err(|e| AppError::General(format!("Failed to start Ollama: {e}")))?;
        Ok(())
    }
}

/// Pull an Ollama model and emit progress events.
///
/// Emits `ollama-pull-progress` with:
/// `{ model, status, percent, done }`
#[tauri::command]
pub async fn pull_ollama_model(app: AppHandle, model: String) -> Result<(), AppError> {
    let client = reqwest::Client::new();
    let response = client
        .post("http://localhost:11434/api/pull")
        .json(&serde_json::json!({
            "model": &model,
            "stream": true
        }))
        .send()
        .await
        .map_err(|e| AppError::General(format!("Failed to request Ollama pull: {e}")))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(AppError::General(format!(
            "Ollama pull failed ({status}): {body}"
        )));
    }

    let mut stream = response.bytes_stream();
    let mut buffer = String::new();

    while let Some(chunk) = stream.next().await {
        let chunk =
            chunk.map_err(|e| AppError::General(format!("Ollama pull stream error: {e}")))?;
        buffer.push_str(&String::from_utf8_lossy(&chunk));

        while let Some(newline_idx) = buffer.find('\n') {
            let line = buffer[..newline_idx].trim().to_string();
            buffer = buffer[newline_idx + 1..].to_string();

            if line.is_empty() {
                continue;
            }

            let payload: serde_json::Value = serde_json::from_str(&line).map_err(|e| {
                AppError::General(format!("Failed to parse Ollama pull event: {e}"))
            })?;

            if let Some(err) = payload.get("error").and_then(|v| v.as_str()) {
                return Err(AppError::General(format!("Ollama pull error: {err}")));
            }

            let status = payload
                .get("status")
                .and_then(|v| v.as_str())
                .unwrap_or("Pulling model");
            let total = payload.get("total").and_then(|v| v.as_u64());
            let completed = payload.get("completed").and_then(|v| v.as_u64());
            let done = payload
                .get("done")
                .and_then(|v| v.as_bool())
                .unwrap_or(false);

            let percent = match (total, completed) {
                (Some(t), Some(c)) if t > 0 => ((c as f64 / t as f64) * 100.0).round() as u8,
                _ if done => 100,
                _ => 0,
            };

            let _ = app.emit(
                "ollama-pull-progress",
                serde_json::json!({
                    "model": model,
                    "status": status,
                    "percent": percent.min(100),
                    "done": done
                }),
            );
        }
    }

    let _ = app.emit(
        "ollama-pull-progress",
        serde_json::json!({
            "model": model,
            "status": "Completed",
            "percent": 100,
            "done": true
        }),
    );

    Ok(())
}
