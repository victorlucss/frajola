use super::types::LlmRequest;

const SYSTEM_EN: &str = r#"You are a meeting summarization assistant. Analyze the transcript and produce a JSON object with exactly this schema:

{
  "title": "A short 3-6 word title for this meeting",
  "summary": "A concise 2-4 sentence overview of the meeting",
  "key_points": ["point 1", "point 2", ...],
  "decisions": ["decision 1", "decision 2", ...],
  "action_items": [
    { "description": "task description", "assignee": "person name or null" }
  ]
}

Rules:
- Respond ONLY with valid JSON, no markdown or extra text.
- title: a short descriptive title (3-6 words).
- key_points: 3-7 most important discussion points.
- decisions: any decisions made (empty array if none).
- action_items: tasks mentioned with assignees when identifiable (null if unknown).
- Keep language concise and professional."#;

const SYSTEM_PT: &str = r#"Voce e um assistente de resumo de reunioes. Analise a transcricao e produza um objeto JSON com exatamente este esquema:

{
  "title": "Um titulo curto de 3-6 palavras para esta reuniao",
  "summary": "Um resumo conciso de 2-4 frases sobre a reuniao",
  "key_points": ["ponto 1", "ponto 2", ...],
  "decisions": ["decisao 1", "decisao 2", ...],
  "action_items": [
    { "description": "descricao da tarefa", "assignee": "nome da pessoa ou null" }
  ]
}

Regras:
- Responda APENAS com JSON valido, sem markdown ou texto extra.
- title: um titulo descritivo curto (3-6 palavras).
- key_points: 3-7 pontos mais importantes da discussao.
- decisions: decisoes tomadas (array vazio se nenhuma).
- action_items: tarefas mencionadas com responsaveis quando identificaveis (null se desconhecido).
- Mantenha a linguagem concisa e profissional."#;

/// Build the system and user prompts for the given transcript and language.
pub fn build_prompt(transcript: &str, language: &str) -> LlmRequest {
    let system = if language.starts_with("pt") {
        SYSTEM_PT
    } else {
        SYSTEM_EN
    };

    let user = format!("Meeting transcript:\n\n{transcript}");

    LlmRequest {
        system: system.to_string(),
        user,
    }
}
