use reqwest::Client;
use serde::{Deserialize, Serialize};

use crate::error::AppError;

use super::types::LlmResponse;

const DEFAULT_BASE_URL: &str = "http://localhost:11434";

#[derive(Debug, Serialize)]
struct ChatRequest {
    model: String,
    messages: Vec<Message>,
    stream: bool,
    format: &'static str,
}

#[derive(Debug, Serialize)]
struct Message {
    role: &'static str,
    content: String,
}

#[derive(Debug, Deserialize)]
struct ChatResponse {
    message: ResponseMessage,
}

#[derive(Debug, Deserialize)]
struct ResponseMessage {
    content: String,
}

#[derive(Debug, Serialize)]
pub struct OllamaStatus {
    pub available: bool,
    pub models: Vec<String>,
}

#[derive(Debug, Deserialize)]
struct TagsResponse {
    models: Option<Vec<TagModel>>,
}

#[derive(Debug, Deserialize)]
struct TagModel {
    name: String,
}

pub struct OllamaClient {
    client: Client,
    base_url: String,
}

impl OllamaClient {
    pub fn new(base_url: Option<&str>) -> Self {
        Self {
            client: Client::new(),
            base_url: base_url.unwrap_or(DEFAULT_BASE_URL).to_string(),
        }
    }

    /// Check if Ollama is reachable and list available models.
    pub async fn check_status(&self) -> OllamaStatus {
        let url = format!("{}/api/tags", self.base_url);
        match self.client.get(&url).send().await {
            Ok(resp) if resp.status().is_success() => {
                let tags: TagsResponse = resp.json().await.unwrap_or(TagsResponse { models: None });
                let models = tags
                    .models
                    .unwrap_or_default()
                    .into_iter()
                    .map(|m| m.name)
                    .collect();
                OllamaStatus {
                    available: true,
                    models,
                }
            }
            _ => OllamaStatus {
                available: false,
                models: vec![],
            },
        }
    }

    /// Send a chat completion request to Ollama.
    pub async fn chat(
        &self,
        model: &str,
        system: &str,
        user: &str,
    ) -> Result<LlmResponse, AppError> {
        let url = format!("{}/api/chat", self.base_url);

        let body = ChatRequest {
            model: model.to_string(),
            messages: vec![
                Message {
                    role: "system",
                    content: system.to_string(),
                },
                Message {
                    role: "user",
                    content: user.to_string(),
                },
            ],
            stream: false,
            format: "json",
        };

        let resp = self
            .client
            .post(&url)
            .json(&body)
            .send()
            .await
            .map_err(|e| AppError::General(format!("Ollama request failed: {e}")))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            return Err(AppError::General(format!(
                "Ollama returned {status}: {text}"
            )));
        }

        let chat_resp: ChatResponse = resp
            .json()
            .await
            .map_err(|e| AppError::General(format!("Failed to parse Ollama response: {e}")))?;

        let llm_response: LlmResponse = serde_json::from_str(&chat_resp.message.content)
            .map_err(|e| {
                AppError::General(format!(
                    "Failed to parse LLM JSON: {e}\nRaw: {}",
                    chat_resp.message.content
                ))
            })?;

        Ok(llm_response)
    }
}
