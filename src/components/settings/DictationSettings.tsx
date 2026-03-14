import { useState, useCallback, useEffect } from "react";
import { invoke } from "../../lib/tauri";
import { SelectField } from "./fields";

interface DictationConfig {
  enabled: boolean;
  hotkeyMode: string;
  sttEngine: string;
  language: string;
  llmEnabled: boolean;
  llmCorrectionLevel: number;
  llmProvider: string;
  llmModel: string;
  llmApiKey: string;
  llmEndpoint: string;
  flowMode: boolean;
  codeMode: boolean;
}

interface DictationSnippet {
  trigger: string;
  expansion: string;
}

interface DictationVoiceCommand {
  trigger: string;
  key_combo: string;
}

export default function DictationSettings() {
  const [config, setConfig] = useState<DictationConfig | null>(null);
  const [accessOk, setAccessOk] = useState<boolean | null>(null);
  const [snippets, setSnippets] = useState<DictationSnippet[]>([]);
  const [voiceCommands, setVoiceCommands] = useState<DictationVoiceCommand[]>([]);
  const [dictionary, setDictionary] = useState<string[]>([]);

  // New entry state
  const [newDictWord, setNewDictWord] = useState("");
  const [newSnipTrigger, setNewSnipTrigger] = useState("");
  const [newSnipExpansion, setNewSnipExpansion] = useState("");
  const [newVcTrigger, setNewVcTrigger] = useState("");
  const [newVcCombo, setNewVcCombo] = useState("");

  const load = useCallback(async () => {
    try {
      const [cfg, acc, snips, vcs, dict] = await Promise.all([
        invoke<DictationConfig>("get_dictation_config"),
        invoke<boolean>("check_accessibility"),
        invoke<DictationSnippet[]>("get_dictation_snippets"),
        invoke<DictationVoiceCommand[]>("get_dictation_voice_commands"),
        invoke<string[]>("get_dictation_dictionary"),
      ]);
      setConfig(cfg);
      setAccessOk(acc);
      setSnippets(snips);
      setVoiceCommands(vcs);
      setDictionary(dict);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = useCallback(async (patch: Partial<DictationConfig>) => {
    if (!config) return;
    const updated = { ...config, ...patch };
    setConfig(updated);
    await invoke("save_dictation_config", { config: updated });
  }, [config]);

  if (!config) {
    return <p className="text-sm text-text-tertiary">Loading...</p>;
  }

  return (
    <div className="space-y-4">
      {/* Enable / Disable */}
      <div className="rounded-lg border border-border bg-bg-card p-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-text-primary">Dictation</p>
            <p className="text-xs text-text-secondary mt-1">
              {config.enabled
                ? "Enabled. Press Alt+Space to dictate."
                : "Disabled. Hotkey is inactive."}
            </p>
          </div>
          <button
            onClick={() => save({ enabled: !config.enabled })}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              config.enabled
                ? "bg-accent text-white hover:bg-accent/90"
                : "border border-border text-text-secondary hover:bg-bg-card-hover"
            }`}
          >
            {config.enabled ? "Disable" : "Enable"}
          </button>
        </div>
      </div>

      {/* Accessibility check */}
      <div className="rounded-lg border border-border bg-bg-card p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${accessOk ? "bg-green-400" : "bg-red-400"}`} />
            <span className="text-sm text-text-secondary">
              {accessOk ? "Accessibility granted" : "Accessibility required"}
            </span>
          </div>
          {!accessOk && (
            <button
              onClick={() => invoke("open_accessibility_settings")}
              className="text-xs text-accent hover:text-accent/80 transition-colors"
            >
              Open Settings
            </button>
          )}
        </div>
      </div>

      <div className={config.enabled ? "" : "opacity-50 pointer-events-none"}>
        {/* Engine & Language */}
        <div className="space-y-4">
          <SelectField
            label="Speech Engine"
            value={config.sttEngine}
            options={[
              { value: "apple", label: "Apple Speech (Real-time)" },
              { value: "whisper", label: "Whisper (Local)" },
            ]}
            onChange={(v) => save({ sttEngine: v })}
          />

          <SelectField
            label="Language"
            value={config.language}
            options={[
              { value: "en", label: "English" },
              { value: "pt", label: "Portuguese" },
              { value: "es", label: "Spanish" },
              { value: "fr", label: "French" },
              { value: "de", label: "German" },
              { value: "it", label: "Italian" },
              { value: "ja", label: "Japanese" },
              { value: "zh", label: "Chinese" },
            ]}
            onChange={(v) => save({ language: v })}
          />

          <SelectField
            label="Hotkey Mode"
            value={config.hotkeyMode}
            options={[
              { value: "toggle", label: "Toggle (press to start/stop)" },
              { value: "hold", label: "Push-to-talk (hold to dictate)" },
            ]}
            onChange={(v) => save({ hotkeyMode: v })}
          />

          {/* Mode toggles */}
          <div className="flex gap-2">
            <ToggleChip label="Flow Mode" active={config.flowMode} onChange={(v) => save({ flowMode: v })} />
            <ToggleChip label="Code Mode" active={config.codeMode} onChange={(v) => save({ codeMode: v })} />
          </div>

          {/* LLM Enhancement */}
          <div className="rounded-lg border border-border bg-bg-card p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-text-primary">LLM Enhancement</p>
                <p className="text-xs text-text-secondary mt-1">
                  {config.llmEnabled
                    ? "Enabled. Post-processing dictation with an LLM."
                    : "Disabled. Configure provider in AI Provider settings."}
                </p>
              </div>
              <button
                onClick={() => save({ llmEnabled: !config.llmEnabled })}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  config.llmEnabled
                    ? "bg-accent text-white hover:bg-accent/90"
                    : "border border-border text-text-secondary hover:bg-bg-card-hover"
                }`}
              >
                {config.llmEnabled ? "On" : "Off"}
              </button>
            </div>
          </div>

          {/* Dictionary */}
          <CrudList
            title="Dictionary"
            description="Custom words for better recognition."
            items={dictionary}
            renderItem={(word) => <span className="text-sm text-text-primary">{word}</span>}
            onRemove={async (word) => {
              await invoke("remove_dictation_dictionary_entry", { entry: word });
              setDictionary((d) => d.filter((w) => w !== word));
            }}
            addRow={
              <div className="flex gap-2">
                <input
                  value={newDictWord}
                  onChange={(e) => setNewDictWord(e.target.value)}
                  placeholder="Add word..."
                  className="flex-1 rounded-lg border border-border bg-bg-card px-3 py-1.5 text-sm text-text-primary outline-none focus:border-accent placeholder:text-text-muted"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newDictWord.trim()) {
                      invoke("add_dictation_dictionary_entry", { entry: newDictWord.trim() }).then(() => {
                        setDictionary((d) => [...d, newDictWord.trim()].sort());
                        setNewDictWord("");
                      });
                    }
                  }}
                />
                <button
                  onClick={() => {
                    if (!newDictWord.trim()) return;
                    invoke("add_dictation_dictionary_entry", { entry: newDictWord.trim() }).then(() => {
                      setDictionary((d) => [...d, newDictWord.trim()].sort());
                      setNewDictWord("");
                    });
                  }}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-white bg-accent hover:bg-accent/90 transition-colors"
                >
                  Add
                </button>
              </div>
            }
          />

          {/* Snippets */}
          <CrudList
            title="Snippets"
            description="Say the trigger phrase to expand text."
            items={snippets}
            renderItem={(s) => (
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-medium text-accent">{s.trigger}</span>
                <span className="text-xs text-text-tertiary">&rarr;</span>
                <span className="text-sm text-text-primary truncate">{s.expansion}</span>
              </div>
            )}
            onRemove={async (s) => {
              await invoke("remove_dictation_snippet", { trigger: s.trigger });
              setSnippets((list) => list.filter((x) => x.trigger !== s.trigger));
            }}
            addRow={
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    value={newSnipTrigger}
                    onChange={(e) => setNewSnipTrigger(e.target.value)}
                    placeholder="Trigger..."
                    className="w-1/3 rounded-lg border border-border bg-bg-card px-3 py-1.5 text-sm text-text-primary outline-none focus:border-accent placeholder:text-text-muted"
                  />
                  <input
                    value={newSnipExpansion}
                    onChange={(e) => setNewSnipExpansion(e.target.value)}
                    placeholder="Expansion text..."
                    className="flex-1 rounded-lg border border-border bg-bg-card px-3 py-1.5 text-sm text-text-primary outline-none focus:border-accent placeholder:text-text-muted"
                  />
                  <button
                    onClick={() => {
                      if (!newSnipTrigger.trim() || !newSnipExpansion.trim()) return;
                      invoke("add_dictation_snippet", { trigger: newSnipTrigger.trim(), expansion: newSnipExpansion.trim() }).then(() => {
                        setSnippets((list) => [...list, { trigger: newSnipTrigger.trim(), expansion: newSnipExpansion.trim() }]);
                        setNewSnipTrigger("");
                        setNewSnipExpansion("");
                      });
                    }}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-white bg-accent hover:bg-accent/90 transition-colors"
                  >
                    Add
                  </button>
                </div>
              </div>
            }
          />

          {/* Voice Commands */}
          <CrudList
            title="Voice Commands"
            description="Say the trigger to execute a key combo."
            items={voiceCommands}
            renderItem={(vc) => (
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-medium text-accent">{vc.trigger}</span>
                <span className="text-xs text-text-tertiary">&rarr;</span>
                <span className="text-sm text-text-primary font-mono">{vc.key_combo}</span>
              </div>
            )}
            onRemove={async (vc) => {
              await invoke("remove_dictation_voice_command", { trigger: vc.trigger });
              setVoiceCommands((list) => list.filter((x) => x.trigger !== vc.trigger));
            }}
            addRow={
              <div className="flex gap-2">
                <input
                  value={newVcTrigger}
                  onChange={(e) => setNewVcTrigger(e.target.value)}
                  placeholder="Trigger..."
                  className="w-1/3 rounded-lg border border-border bg-bg-card px-3 py-1.5 text-sm text-text-primary outline-none focus:border-accent placeholder:text-text-muted"
                />
                <input
                  value={newVcCombo}
                  onChange={(e) => setNewVcCombo(e.target.value)}
                  placeholder="cmd+shift+3"
                  className="flex-1 rounded-lg border border-border bg-bg-card px-3 py-1.5 text-sm text-text-primary outline-none focus:border-accent placeholder:text-text-muted font-mono"
                />
                <button
                  onClick={() => {
                    if (!newVcTrigger.trim() || !newVcCombo.trim()) return;
                    invoke("add_dictation_voice_command", { trigger: newVcTrigger.trim(), keyCombo: newVcCombo.trim() }).then(() => {
                      setVoiceCommands((list) => [...list, { trigger: newVcTrigger.trim(), key_combo: newVcCombo.trim() }]);
                      setNewVcTrigger("");
                      setNewVcCombo("");
                    });
                  }}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-white bg-accent hover:bg-accent/90 transition-colors"
                >
                  Add
                </button>
              </div>
            }
          />
        </div>
      </div>
    </div>
  );
}

/* ── Toggle Chip ── */

function ToggleChip({ label, active, onChange }: { label: string; active: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!active)}
      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? "bg-accent/10 text-accent border border-accent/30"
          : "border border-border text-text-tertiary hover:text-text-secondary hover:bg-bg-card-hover"
      }`}
    >
      {label}
    </button>
  );
}

/* ── CRUD List ── */

function CrudList<T>({
  title,
  description,
  items,
  renderItem,
  onRemove,
  addRow,
}: {
  title: string;
  description: string;
  items: T[];
  renderItem: (item: T) => React.ReactNode;
  onRemove: (item: T) => void;
  addRow: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-bg-card p-3 space-y-2">
      <div>
        <p className="text-sm font-medium text-text-primary">{title}</p>
        <p className="text-xs text-text-secondary mt-0.5">{description}</p>
      </div>
      {items.length > 0 && (
        <div className="space-y-1 max-h-32 overflow-y-auto">
          {items.map((item, i) => (
            <div key={i} className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-bg-card-hover group">
              <div className="min-w-0 flex-1">{renderItem(item)}</div>
              <button
                onClick={() => onRemove(item)}
                className="ml-2 flex h-5 w-5 shrink-0 items-center justify-center rounded text-text-tertiary opacity-0 group-hover:opacity-100 hover:text-red-400 hover:bg-red-400/10 transition-all"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
      {addRow}
    </div>
  );
}
