use reqwest::Client;
use serde::{Deserialize, Serialize};

use crate::error::AppError;

use super::types::LlmResponse;

const API_URL: &str = "https://api.anthropic.com/v1/messages";
const API_VERSION: &str = "2023-06-01";

#[derive(Debug, Serialize)]
struct MessagesRequest {
    model: String,
    max_tokens: u32,
    system: String,
    messages: Vec<Message>,
}

#[derive(Debug, Serialize)]
struct Message {
    role: &'static str,
    content: String,
}

#[derive(Debug, Deserialize)]
struct MessagesResponse {
    content: Vec<ContentBlock>,
}

#[derive(Debug, Deserialize)]
struct ContentBlock {
    text: Option<String>,
}

pub struct AnthropicClient {
    client: Client,
    api_key: String,
}

impl AnthropicClient {
    pub fn new(api_key: &str) -> Self {
        Self {
            client: Client::new(),
            api_key: api_key.to_string(),
        }
    }

    pub async fn chat(
        &self,
        model: &str,
        system: &str,
        user: &str,
    ) -> Result<LlmResponse, AppError> {
        let body = MessagesRequest {
            model: model.to_string(),
            max_tokens: 4096,
            system: system.to_string(),
            messages: vec![Message {
                role: "user",
                content: user.to_string(),
            }],
        };

        let resp = self
            .client
            .post(API_URL)
            .header("x-api-key", &self.api_key)
            .header("anthropic-version", API_VERSION)
            .header("content-type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| AppError::General(format!("Anthropic request failed: {e}")))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            return Err(AppError::General(format!(
                "Anthropic returned {status}: {text}"
            )));
        }

        let msg_resp: MessagesResponse = resp
            .json()
            .await
            .map_err(|e| AppError::General(format!("Failed to parse Anthropic response: {e}")))?;

        let content = msg_resp
            .content
            .first()
            .and_then(|b| b.text.as_deref())
            .ok_or_else(|| AppError::General("Anthropic returned no text content".into()))?;

        let llm_response: LlmResponse =
            serde_json::from_str(content).map_err(|e| {
                AppError::General(format!("Failed to parse LLM JSON: {e}\nRaw: {content}"))
            })?;

        Ok(llm_response)
    }
}
