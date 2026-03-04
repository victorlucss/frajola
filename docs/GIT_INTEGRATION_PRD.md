# Git Integration PRD (Draft)

## Metadata
- Status: Draft
- Owner: Frajola product/engineering
- Date: 2026-03-04
- Related docs: `docs/PRD.md`, `site/next-features.html`

## 1. Objective
Enable users to version and share meeting artifacts (audio, transcript, summary, notes) through a Git repository directly from Frajola.

## 2. Problem
Users currently keep recordings and notes only in the local app database/filesystem. Teams and technical users want:
- auditable history of meeting outputs,
- easy sharing via pull requests,
- a portable archive independent of the local SQLite app state.

## 3. Product Principles
- Explicit opt-in only.
- Local-first behavior preserved.
- No hidden network calls.
- Predictable file layout and deterministic commits.
- Safe defaults that avoid accidental data leaks.

## 4. Scope

### In scope (v1)
- Connect an existing local git repo path.
- Initialize a new local git repo from app.
- Export meeting artifacts to repo in a deterministic folder structure.
- Stage/commit selected artifacts from app.
- Optional push to tracked remote.
- Manual sync per meeting and batch sync for unsynced meetings.
- Conventional commit message templates.
- Basic sync history and error surface in UI.

### In scope (v1.1)
- Auto-sync after transcription/summarization completion.
- Optional pull/rebase before push.
- Git LFS detection and recommendation for audio.

### Out of scope (first release)
- OAuth-based provider login (GitHub/GitLab auth flows).
- Merge conflict visual editor in app.
- Branch/PR creation workflows.
- End-to-end encrypted artifact layer.

## 5. User Stories
1. As a developer, I want to sync one meeting to a repo so I can open a PR with transcript and notes.
2. As a consultant, I want daily batch sync so client records are archived consistently.
3. As a privacy-conscious user, I want to exclude raw audio and push only markdown artifacts.
4. As a maintainer, I want clear sync logs to debug failed pushes.

## 6. UX Draft

### 6.1 Settings -> Integrations -> Git
Fields:
- Git integration toggle (`enabled/disabled`)
- Repo path
- Branch (default: current checked-out branch)
- Sync mode (`manual`, `auto_after_processing`)
- Include artifacts:
  - audio
  - transcript
  - summary/notes
  - metadata JSON
- Push mode (`commit_only`, `commit_and_push`)
- Commit message template selector

Actions:
- `Connect Repo`
- `Initialize Repo`
- `Validate`
- `Sync Unsynced Meetings`

### 6.2 Meeting Detail
Add action buttons:
- `Sync to Git`
- `View Last Sync`

### 6.3 Sync Status UI
Per meeting status badge:
- `Not synced`
- `Synced`
- `Sync failed`
- `Conflict`

## 7. Artifact Layout

Repo root layout (default):

```text
frajola-meetings/
  meetings/
    YYYY/
      MM/
        DD/
          <meeting_id>-<slug>/
            metadata.json
            transcript.md
            summary.md
            audio.wav        # optional
```

Notes:
- `<slug>` is derived from meeting title and sanitized to lowercase kebab-case.
- Writes are idempotent: same meeting ID rewrites the same folder.
- `summary.md` contains overview, key points, action items, decisions.

## 8. Metadata Contract (`metadata.json`)

```json
{
  "meeting_id": 142,
  "title": "weekly-platform-sync",
  "created_at": "2026-03-04T14:32:10Z",
  "duration_seconds": 2740,
  "status": "complete",
  "language": "en",
  "ai_provider": "ollama",
  "ai_model": "qwen3.5:4b",
  "whisper_model": "base"
}
```

## 9. Commit Strategy

Default commit types:
- New sync: `feat(sync): add meeting <id> artifacts`
- Re-sync update: `chore(sync): update meeting <id> artifacts`
- Batch sync: `chore(sync): sync <N> meetings`

Commit body includes:
- meeting title/date,
- included artifact types,
- provider/model info for summary generation.

## 10. Backend Design (Tauri + Rust)

### 10.1 New module
`src-tauri/src/git/`
- `mod.rs`
- `types.rs` (DTOs and enums)
- `repo.rs` (repo detection/init/status)
- `sync.rs` (artifact write + add/commit/push)
- `format.rs` (markdown/metadata renderers)

### 10.2 Commands
Add `src-tauri/src/commands/git.rs` with commands:
- `git_get_config()`
- `git_set_config(...)`
- `git_validate_repo(path)`
- `git_init_repo(path)`
- `git_sync_meeting(meeting_id)`
- `git_sync_unsynced()`
- `git_get_sync_history(limit)`

### 10.3 Event stream
Emit progress events:
- `git-sync-started`
- `git-sync-progress`
- `git-sync-complete`
- `git-sync-failed`

## 11. Data Model Changes

Add migration `003_git_integration.sql`:

### `git_sync_runs`
- `id INTEGER PRIMARY KEY`
- `meeting_id INTEGER NULL`
- `started_at TEXT NOT NULL`
- `finished_at TEXT NULL`
- `status TEXT NOT NULL` (`running|complete|failed|conflict`)
- `commit_sha TEXT NULL`
- `error_message TEXT NULL`

### `meeting_git_refs`
- `meeting_id INTEGER PRIMARY KEY REFERENCES meetings(id) ON DELETE CASCADE`
- `last_commit_sha TEXT`
- `last_synced_at TEXT`
- `sync_status TEXT NOT NULL DEFAULT 'not_synced'`

### settings keys
- `git_enabled`
- `git_repo_path`
- `git_branch`
- `git_sync_mode`
- `git_push_mode`
- `git_include_audio`
- `git_include_transcript`
- `git_include_summary`
- `git_include_metadata`
- `git_commit_template`

## 12. Sync Algorithm (v1)
1. Validate git integration is enabled and repo path exists.
2. Resolve meeting artifacts from DB and filesystem.
3. Render markdown/json files into deterministic folder path.
4. Stage selected files (`git add <paths>`).
5. Create commit if staged diff exists.
6. Push if mode is `commit_and_push`.
7. Store run result in `git_sync_runs` and update `meeting_git_refs`.

## 13. Error Handling
- Missing git binary: block with actionable install message.
- Repo not clean: allow commit; surface existing dirty state warning.
- Push rejected/non-fast-forward: mark as `conflict`, show pull/rebase recommendation.
- Missing audio file while audio export enabled: sync remaining artifacts and warn.
- Empty change set: treat as success with `no_changes` message.

## 14. Privacy & Security
- No credentials stored by Frajola beyond what git already uses locally.
- Explicit warning before first push.
- Allow "text-only" mode (no audio export).
- Never commit API keys or internal app DB files.
- Add ignore template suggestion:

```gitignore
# Frajola local internals (do not commit)
*.db
*.db-shm
*.db-wal
```

## 15. Acceptance Criteria
- User can connect/init a repository from Settings.
- User can sync a single completed meeting in under 3 clicks.
- Commit created with deterministic file paths and conventional message.
- Batch sync supports at least 100 meetings without app crash.
- Failures are visible in UI with actionable messages.
- User can disable audio export and sync only text artifacts.

## 16. Milestones

### M1 - Manual Sync Foundation
- Schema migration + settings keys
- Repo connect/init + validate
- Single meeting sync + commit
- Basic history log

### M2 - Batch + Push
- Batch sync command
- Optional push mode
- Conflict/failure states in UI

### M3 - Automation + Hardening
- Auto-sync post-processing
- LFS recommendation for large audio
- Improved retry behavior and metrics

## 17. Open Questions
1. Should default branch be enforced (`main`) or inherit current checked-out branch?
2. Do we allow sync when meeting status is not `complete`?
3. Should `transcript.md` include timestamps by default or optional toggle?
4. Do we need per-repo encryption support for especially sensitive teams?
