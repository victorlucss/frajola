use reqwest::Client;
use serde::{Deserialize, Serialize};

use crate::error::AppError;

use super::types::LlmResponse;

const API_URL: &str = "https://api.openai.com/v1/chat/completions";

#[derive(Debug, Serialize)]
struct ChatRequest {
    model: String,
    messages: Vec<Message>,
    response_format: ResponseFormat,
}

#[derive(Debug, Serialize)]
struct Message {
    role: &'static str,
    content: String,
}

#[derive(Debug, Serialize)]
struct ResponseFormat {
    r#type: &'static str,
}

#[derive(Debug, Deserialize)]
struct ChatResponse {
    choices: Vec<Choice>,
}

#[derive(Debug, Deserialize)]
struct Choice {
    message: ResponseMessage,
}

#[derive(Debug, Deserialize)]
struct ResponseMessage {
    content: String,
}

pub struct OpenAiClient {
    client: Client,
    api_key: String,
}

impl OpenAiClient {
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
            response_format: ResponseFormat {
                r#type: "json_object",
            },
        };

        let resp = self
            .client
            .post(API_URL)
            .bearer_auth(&self.api_key)
            .json(&body)
            .send()
            .await
            .map_err(|e| AppError::General(format!("OpenAI request failed: {e}")))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            return Err(AppError::General(format!(
                "OpenAI returned {status}: {text}"
            )));
        }

        let chat_resp: ChatResponse = resp
            .json()
            .await
            .map_err(|e| AppError::General(format!("Failed to parse OpenAI response: {e}")))?;

        let content = chat_resp
            .choices
            .first()
            .map(|c| c.message.content.as_str())
            .ok_or_else(|| AppError::General("OpenAI returned no choices".into()))?;

        let llm_response: LlmResponse =
            serde_json::from_str(content).map_err(|e| {
                AppError::General(format!("Failed to parse LLM JSON: {e}\nRaw: {content}"))
            })?;

        Ok(llm_response)
    }
}
