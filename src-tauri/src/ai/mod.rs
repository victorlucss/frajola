pub mod anthropic;
pub mod ollama;
pub mod openai;
pub mod prompts;
pub mod types;

use crate::db::Database;
use crate::error::AppError;

use self::anthropic::AnthropicClient;
use self::ollama::OllamaClient;
use self::openai::OpenAiClient;
use self::prompts::build_prompt;
use self::types::LlmResponse;

/// Run summarization against the configured LLM provider.
///
/// Reads `ai_provider`, `ai_model`, and relevant API keys from settings,
/// builds the prompt from the transcript text, and dispatches to the correct client.
pub async fn summarize(
    db: &Database,
    transcript_text: &str,
    language: &str,
) -> Result<(LlmResponse, String, String), AppError> {
    let provider = db
        .get_setting("ai_provider")?
        .unwrap_or_else(|| "ollama".to_string());

    let request = build_prompt(transcript_text, language);

    match provider.as_str() {
        "ollama" => {
            let model = db
                .get_setting("ai_model")?
                .unwrap_or_else(|| "llama3.2".to_string());

            let client = OllamaClient::new(None);
            let response = client.chat(&model, &request.system, &request.user).await?;
            Ok((response, provider, model))
        }
        "openai" => {
            let api_key = db
                .get_setting("openai_api_key")?
                .ok_or_else(|| AppError::General("OpenAI API key not configured".into()))?;

            let model = db
                .get_setting("ai_model")?
                .unwrap_or_else(|| "gpt-4o-mini".to_string());

            let client = OpenAiClient::new(&api_key);
            let response = client.chat(&model, &request.system, &request.user).await?;
            Ok((response, provider, model))
        }
        "anthropic" => {
            let api_key = db
                .get_setting("anthropic_api_key")?
                .ok_or_else(|| AppError::General("Anthropic API key not configured".into()))?;

            let model = db
                .get_setting("ai_model")?
                .unwrap_or_else(|| "claude-haiku-4-5-20251001".to_string());

            let client = AnthropicClient::new(&api_key);
            let response = client.chat(&model, &request.system, &request.user).await?;
            Ok((response, provider, model))
        }
        other => Err(AppError::General(format!(
            "Unknown AI provider: {other}"
        ))),
    }
}
