/// Integration tests for the dictation pipeline.
///
/// These tests verify the end-to-end flow from raw transcription through
/// the processor pipeline (snippets, voice commands, LLM config) and
/// the database CRUD operations.
use frajola_lib::dictation::processor::{
    default_dictation_prompt, normalize_transcription, process_transcription, DictationLlmConfig,
    DictationSnippet, DictationVoiceCommand, ProcessResult,
};

// ─── Pipeline Integration Tests ──────────────────────────

#[tokio::test]
async fn test_pipeline_snippet_takes_priority_over_command() {
    // If a transcription matches both a snippet and a voice command,
    // snippet should win (checked first in pipeline).
    let snippets = vec![DictationSnippet {
        trigger: "hello".to_string(),
        expansion: "Hello, world!".to_string(),
    }];
    let commands = vec![DictationVoiceCommand {
        trigger: "hello".to_string(),
        key_combo: "cmd+h".to_string(),
    }];

    let result = process_transcription(
        "Hello",
        &snippets,
        &commands,
        &[],
        &DictationLlmConfig::default(),
        "Unknown",
    )
    .await;

    match result {
        ProcessResult::Snippet(text) => assert_eq!(text, "Hello, world!"),
        _ => panic!("Expected Snippet to take priority over KeyCombo"),
    }
}

#[tokio::test]
async fn test_pipeline_no_match_returns_raw_text() {
    let snippets = vec![DictationSnippet {
        trigger: "my email".to_string(),
        expansion: "test@test.com".to_string(),
    }];

    let result = process_transcription(
        "This is a normal sentence",
        &snippets,
        &[],
        &[],
        &DictationLlmConfig::default(),
        "Unknown",
    )
    .await;

    match result {
        ProcessResult::Text(text) => assert_eq!(text, "This is a normal sentence"),
        _ => panic!("Expected passthrough Text result"),
    }
}

#[tokio::test]
async fn test_pipeline_normalization_handles_punctuation() {
    let snippets = vec![DictationSnippet {
        trigger: "thanks".to_string(),
        expansion: "Thank you very much!".to_string(),
    }];

    // Should match even with punctuation and extra whitespace
    let result = process_transcription(
        "  Thanks!  ",
        &snippets,
        &[],
        &[],
        &DictationLlmConfig::default(),
        "Unknown",
    )
    .await;

    match result {
        ProcessResult::Snippet(text) => assert_eq!(text, "Thank you very much!"),
        _ => panic!("Expected Snippet match despite punctuation"),
    }
}

#[tokio::test]
async fn test_pipeline_voice_command() {
    let commands = vec![
        DictationVoiceCommand {
            trigger: "undo".to_string(),
            key_combo: "cmd+z".to_string(),
        },
        DictationVoiceCommand {
            trigger: "save".to_string(),
            key_combo: "cmd+s".to_string(),
        },
    ];

    let result = process_transcription(
        "Save.",
        &[],
        &commands,
        &[],
        &DictationLlmConfig::default(),
        "Unknown",
    )
    .await;

    match result {
        ProcessResult::KeyCombo(combo) => assert_eq!(combo, "cmd+s"),
        _ => panic!("Expected KeyCombo result"),
    }
}

#[tokio::test]
async fn test_pipeline_llm_disabled_passes_through() {
    let config = DictationLlmConfig {
        enabled: false,
        ..Default::default()
    };

    let result = process_transcription(
        "um like hello world you know",
        &[],
        &[],
        &[],
        &config,
        "Slack",
    )
    .await;

    match result {
        ProcessResult::Text(text) => {
            assert_eq!(text, "um like hello world you know");
        }
        _ => panic!("Expected raw text passthrough when LLM disabled"),
    }
}

// ─── Normalization Tests ─────────────────────────────────

#[test]
fn test_normalization_edge_cases() {
    assert_eq!(normalize_transcription(""), "");
    assert_eq!(normalize_transcription("   "), "");
    assert_eq!(normalize_transcription("...hello..."), "hello");
    assert_eq!(normalize_transcription("UPPERCASE"), "uppercase");
    assert_eq!(
        normalize_transcription("multiple   spaces   between   words"),
        "multiple spaces between words"
    );
}

#[test]
fn test_normalization_preserves_internal_punctuation() {
    // Internal punctuation like hyphens should be preserved in matching
    assert_eq!(normalize_transcription("well-known"), "well-known");
}

// ─── Default Prompt Test ─────────────────────────────────

#[test]
fn test_default_prompt_contains_key_instructions() {
    let prompt = default_dictation_prompt();
    assert!(prompt.contains("transcription corrector"));
    assert!(prompt.contains("NOT an assistant"));
    assert!(prompt.contains("filler words"));
}

// ─── Database Integration Tests ──────────────────────────

#[test]
fn test_db_full_dictation_workflow() {
    let tmp = tempfile::NamedTempFile::new().unwrap();
    let db = frajola_lib::db::Database::new(tmp.path()).unwrap();

    // 1. Set up dictionary
    db.add_dictation_dictionary_entry("Frajola").unwrap();
    db.add_dictation_dictionary_entry("Tauri").unwrap();
    let dict = db.get_dictation_dictionary().unwrap();
    assert_eq!(dict.len(), 2);

    // 2. Set up snippets
    db.add_dictation_snippet("my email", "victor@example.com")
        .unwrap();
    let snippets = db.get_dictation_snippets().unwrap();
    assert_eq!(snippets.len(), 1);

    // 3. Set up voice commands
    db.add_dictation_voice_command("screenshot", "cmd+shift+3")
        .unwrap();
    let commands = db.get_dictation_voice_commands().unwrap();
    assert_eq!(commands.len(), 1);

    // 4. Simulate history entries
    db.add_dictation_history("hello world", "Hello, world.", Some("Slack"), Some("whisper"))
        .unwrap();
    db.add_dictation_history("test", "Test.", Some("Code"), Some("apple"))
        .unwrap();
    let history = db.get_dictation_history(10).unwrap();
    assert_eq!(history.len(), 2);
    assert_eq!(history[0].target_app, Some("Code".to_string()));

    // 5. Update settings
    db.set_setting("dictation_llm_enabled", "1").unwrap();
    let val = db.get_setting("dictation_llm_enabled").unwrap();
    assert_eq!(val, Some("1".to_string()));

    // 6. Clean up
    db.clear_dictation_history().unwrap();
    assert!(db.get_dictation_history(10).unwrap().is_empty());

    db.remove_dictation_snippet("my email").unwrap();
    assert!(db.get_dictation_snippets().unwrap().is_empty());

    db.remove_dictation_voice_command("screenshot").unwrap();
    assert!(db.get_dictation_voice_commands().unwrap().is_empty());
}

#[test]
fn test_db_history_limit() {
    let tmp = tempfile::NamedTempFile::new().unwrap();
    let db = frajola_lib::db::Database::new(tmp.path()).unwrap();

    // Add many entries; the limit check (500) should prune older ones
    for i in 0..10 {
        db.add_dictation_history(
            &format!("raw {}", i),
            &format!("processed {}", i),
            None,
            None,
        )
        .unwrap();
    }

    // Request only 5
    let history = db.get_dictation_history(5).unwrap();
    assert_eq!(history.len(), 5);
    // Most recent should be first
    assert_eq!(history[0].raw_text, "raw 9");
}
