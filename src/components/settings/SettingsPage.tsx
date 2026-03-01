import { useState, useEffect, useCallback } from "react";
import { useSettings } from "../../hooks/useSettings";
import { invoke } from "../../lib/tauri";

type Category = "general" | "ai" | "transcription";

interface OllamaStatus {
  available: boolean;
  models: string[];
}

interface Props {
  onClose: () => void;
}

const CATEGORIES: { key: Category; label: string }[] = [
  { key: "general", label: "General" },
  { key: "ai", label: "AI Provider" },
  { key: "transcription", label: "Transcription" },
];

export default function SettingsPage({ onClose }: Props) {
  const [category, setCategory] = useState<Category>("general");
  const { loading, error, getSetting, updateSetting } = useSettings();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" />

      {/* Panel */}
      <div
        className="absolute left-14 bottom-4 w-[420px] max-h-[70vh] overflow-hidden rounded-xl border border-border bg-surface shadow-xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-text-primary">Settings</h2>
          <button
            onClick={onClose}
            className="flex h-6 w-6 items-center justify-center rounded-md text-text-tertiary hover:text-text-secondary hover:bg-bg-card transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 border-b border-border px-4 py-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              onClick={() => setCategory(cat.key)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                category === cat.key
                  ? "bg-bg-card text-text-primary"
                  : "text-text-tertiary hover:text-text-secondary hover:bg-bg-card-hover"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <p className="text-sm text-text-tertiary">Loading settings...</p>
          ) : error ? (
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
              {error}
            </div>
          ) : (
            <>
              {category === "general" && (
                <GeneralSettings getSetting={getSetting} updateSetting={updateSetting} />
              )}
              {category === "ai" && (
                <AiSettings getSetting={getSetting} updateSetting={updateSetting} />
              )}
              {category === "transcription" && (
                <TranscriptionSettings getSetting={getSetting} updateSetting={updateSetting} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

interface SettingsSectionProps {
  getSetting: (key: string) => string | undefined;
  updateSetting: (key: string, value: string) => Promise<void>;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-sm font-medium text-text-secondary mb-1.5">{children}</label>;
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-border bg-bg-card px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function InputField({
  label,
  value,
  type = "text",
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  type?: string;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-border bg-bg-card px-3 py-2 text-sm text-text-primary outline-none focus:border-accent placeholder:text-text-muted"
      />
    </div>
  );
}

function GeneralSettings({ getSetting, updateSetting }: SettingsSectionProps) {
  return (
    <div className="space-y-4">
      <SelectField
        label="Language"
        value={getSetting("language") ?? "en"}
        options={[
          { value: "en", label: "English" },
          { value: "pt", label: "Portugues" },
        ]}
        onChange={(v) => updateSetting("language", v)}
      />
      <SelectField
        label="Theme"
        value={getSetting("theme") ?? "system"}
        options={[
          { value: "system", label: "System" },
          { value: "light", label: "Light" },
          { value: "dark", label: "Dark" },
        ]}
        onChange={(v) => updateSetting("theme", v)}
      />
    </div>
  );
}

function AiSettings({ getSetting, updateSetting }: SettingsSectionProps) {
  const provider = getSetting("ai_provider") ?? "ollama";
  const model = getSetting("ai_model") ?? "";
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus | null>(null);
  const [checkingOllama, setCheckingOllama] = useState(false);

  const checkOllama = useCallback(async () => {
    setCheckingOllama(true);
    try {
      const status = await invoke<OllamaStatus>("check_ollama_status");
      setOllamaStatus(status);
    } catch {
      setOllamaStatus({ available: false, models: [] });
    }
    setCheckingOllama(false);
  }, []);

  useEffect(() => {
    if (provider === "ollama") {
      checkOllama();
    }
  }, [provider, checkOllama]);

  return (
    <div className="space-y-4">
      <SelectField
        label="Provider"
        value={provider}
        options={[
          { value: "ollama", label: "Ollama (Local)" },
          { value: "openai", label: "OpenAI" },
          { value: "anthropic", label: "Anthropic" },
        ]}
        onChange={(v) => updateSetting("ai_provider", v)}
      />

      <InputField
        label="Model"
        value={model}
        placeholder={
          provider === "ollama"
            ? "llama3.2"
            : provider === "openai"
              ? "gpt-4o-mini"
              : "claude-haiku-4-5-20251001"
        }
        onChange={(v) => updateSetting("ai_model", v)}
      />

      {provider === "openai" && (
        <InputField
          label="OpenAI API Key"
          type="password"
          value={getSetting("openai_api_key") ?? ""}
          placeholder="sk-..."
          onChange={(v) => updateSetting("openai_api_key", v)}
        />
      )}

      {provider === "anthropic" && (
        <InputField
          label="Anthropic API Key"
          type="password"
          value={getSetting("anthropic_api_key") ?? ""}
          placeholder="sk-ant-..."
          onChange={(v) => updateSetting("anthropic_api_key", v)}
        />
      )}

      {provider === "ollama" && (
        <div className="rounded-lg border border-border bg-bg-card p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full ${
                  ollamaStatus?.available ? "bg-green-400" : "bg-red-400"
                }`}
              />
              <span className="text-sm text-text-secondary">
                {checkingOllama
                  ? "Checking..."
                  : ollamaStatus?.available
                    ? "Ollama connected"
                    : "Ollama not available"}
              </span>
            </div>
            <button
              onClick={checkOllama}
              disabled={checkingOllama}
              className="text-xs text-accent hover:text-accent/80 transition-colors disabled:opacity-50"
            >
              Refresh
            </button>
          </div>
          {ollamaStatus?.available && ollamaStatus.models.length > 0 && (
            <div className="mt-2 border-t border-border-subtle pt-2">
              <p className="mb-1 text-xs text-text-muted">Available models:</p>
              <div className="flex flex-wrap gap-1">
                {ollamaStatus.models.map((m) => (
                  <span
                    key={m}
                    className="rounded bg-bg px-2 py-0.5 text-xs text-text-tertiary"
                  >
                    {m}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TranscriptionSettings({ getSetting, updateSetting }: SettingsSectionProps) {
  return (
    <div className="space-y-4">
      <SelectField
        label="Whisper Model Size"
        value={getSetting("whisper_model") ?? "base"}
        options={[
          { value: "tiny", label: "Tiny (fastest, least accurate)" },
          { value: "base", label: "Base (balanced)" },
          { value: "small", label: "Small (better accuracy)" },
          { value: "medium", label: "Medium (best accuracy, slowest)" },
        ]}
        onChange={(v) => updateSetting("whisper_model", v)}
      />
    </div>
  );
}
