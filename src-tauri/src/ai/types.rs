use serde::{Deserialize, Serialize};

/// Request payload sent to any LLM provider.
pub struct LlmRequest {
    pub system: String,
    pub user: String,
}

/// Parsed LLM response containing the structured summary.
#[derive(Debug, Deserialize, Serialize)]
pub struct LlmResponse {
    pub title: Option<String>,
    pub summary: String,
    pub key_points: Vec<String>,
    pub decisions: Vec<String>,
    pub action_items: Vec<ActionItemRaw>,
}

/// A single action item extracted by the LLM.
#[derive(Debug, Deserialize, Serialize)]
pub struct ActionItemRaw {
    pub description: String,
    pub assignee: Option<String>,
}
