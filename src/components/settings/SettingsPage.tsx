import { useState, useEffect, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { useSettings } from "../../hooks/useSettings";
import { invoke } from "../../lib/tauri";

type Category = "general" | "ai" | "transcription";

interface OllamaStatus {
  available: boolean;
  models: string[];
}

interface WhisperModel {
  key: string;
  label: string;
  size_label: string;
  downloaded: boolean;
}

interface OllamaModelOption {
  label: string;
  tag: string;
  sizeLabel: string;
}

interface Props {
  onClose: () => void;
}

const CATEGORIES: { key: Category; label: string }[] = [
  { key: "general", label: "General" },
  { key: "ai", label: "AI Provider" },
  { key: "transcription", label: "Transcription" },
];

const OLLAMA_MODEL_OPTIONS: OllamaModelOption[] = [
  { label: "Llama 3.2 1B", tag: "llama3.2:1b", sizeLabel: "~1.3 GB" },
  { label: "Qwen 2.5 3B", tag: "qwen2.5:3b", sizeLabel: "~2.0 GB" },
  { label: "Llama 3.2 3B", tag: "llama3.2:3b", sizeLabel: "~2.0 GB" },
  { label: "Qwen 3.5 4B", tag: "qwen3.5:4b", sizeLabel: "~3.0 GB" },
  { label: "Mistral 7B", tag: "mistral:7b", sizeLabel: "~4.1 GB" },
  { label: "Qwen 2.5 7B", tag: "qwen2.5:7b", sizeLabel: "~4.7 GB" },
  { label: "Llama 3.1 8B", tag: "llama3.1:8b", sizeLabel: "~4.9 GB" },
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
  const mockModeEnabled = (getSetting("mock_mode") ?? "0") === "1";

  return (
    <div className="space-y-4">
      <SelectField
        label="Theme"
        value={getSetting("theme") ?? "system"}
        options={[
          { value: "system", label: "System" },
          { value: "light", label: "Light" },
          { value: "dark", label: "Dark" },
        ]}
        onChange={(v) => {
          void updateSetting("theme", v);
          window.dispatchEvent(new CustomEvent("theme-changed", { detail: v }));
        }}
      />

      <div className="rounded-lg border border-border bg-bg-card p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-text-primary">Mock Data Mode</p>
            <p className="mt-1 text-xs text-text-secondary">
              Force demo meetings for screenshot sessions.
            </p>
          </div>
          <button
            onClick={() => {
              const nextEnabled = !mockModeEnabled;
              void updateSetting("mock_mode", nextEnabled ? "1" : "0");
              window.dispatchEvent(
                new CustomEvent("mock-mode-changed", { detail: nextEnabled }),
              );
            }}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              mockModeEnabled
                ? "bg-accent text-white hover:bg-accent/90"
                : "border border-border text-text-secondary hover:bg-bg-card-hover"
            }`}
          >
            {mockModeEnabled ? "Disable" : "Enable"}
          </button>
        </div>

        <p className="mt-2 text-[11px] text-text-tertiary">
          Tip: you can also launch with <span className="font-mono text-text-secondary">?mock=1</span>.
        </p>
      </div>
    </div>
  );
}

function AiSettings({ getSetting, updateSetting }: SettingsSectionProps) {
  const aiEnabled = (getSetting("ai_enabled") ?? "1") === "1";
  const provider = getSetting("ai_provider") ?? "ollama";
  const model = getSetting("ai_model") ?? "";
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus | null>(null);
  const [checkingOllama, setCheckingOllama] = useState(false);
  const [pullingModel, setPullingModel] = useState<string | null>(null);
  const [pullPercent, setPullPercent] = useState(0);
  const [pullStatus, setPullStatus] = useState("");
  const [modelActionError, setModelActionError] = useState<string | null>(null);
  const [customModel, setCustomModel] = useState("");

  const isOllamaModelInstalled = useCallback(
    (modelTag: string): boolean => {
      const tag = modelTag.trim().toLowerCase();
      if (!tag) return false;
      return (ollamaStatus?.models ?? []).some((m) => {
        const installed = m.trim().toLowerCase();
        if (tag.includes(":")) return installed === tag;
        return installed === tag || installed.startsWith(`${tag}:`);
      });
    },
    [ollamaStatus],
  );

  const checkOllama = useCallback(async () => {
    setCheckingOllama(true);
    try {
      const status = await invoke<OllamaStatus>("check_ollama_status");
      setOllamaStatus(status);
      if (status.available && status.models.length > 0 && !model) {
        updateSetting("ai_model", status.models[0]);
      }
    } catch {
      setOllamaStatus({ available: false, models: [] });
    }
    setCheckingOllama(false);
  }, [model, updateSetting]);

  useEffect(() => {
    if (provider === "ollama" && aiEnabled) {
      void checkOllama();
    }
  }, [provider, aiEnabled, checkOllama]);

  useEffect(() => {
    if (provider !== "ollama") return;
    if (!model) return;
    const isPreset = OLLAMA_MODEL_OPTIONS.some((m) => m.tag === model);
    if (!isPreset) {
      setCustomModel(model);
    }
  }, [provider, model]);

  useEffect(() => {
    if (!pullingModel) return;

    const unlisten = listen<{ model: string; status: string; percent: number }>(
      "ollama-pull-progress",
      (event) => {
        const payload = event.payload;
        const current = pullingModel.toLowerCase();
        const incoming = payload.model.toLowerCase();
        if (incoming === current || incoming.startsWith(`${current}:`)) {
          setPullPercent(payload.percent ?? 0);
          setPullStatus(payload.status ?? "Pulling model...");
        }
      },
    );

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [pullingModel]);

  const handlePullOllamaModel = useCallback(
    async (modelTag: string) => {
      const tag = modelTag.trim();
      if (!tag) {
        setModelActionError("Model tag is empty.");
        return;
      }
      if (!ollamaStatus?.available) {
        setModelActionError("Ollama is not available. Start Ollama and try again.");
        return;
      }

      setModelActionError(null);
      setPullingModel(tag);
      setPullPercent(0);
      setPullStatus("Starting download...");

      try {
        await invoke("pull_ollama_model", { model: tag });
        await checkOllama();
        await updateSetting("ai_model", tag);
      } catch (err) {
        setModelActionError(String(err));
      } finally {
        setPullingModel(null);
        setPullPercent(0);
        setPullStatus("");
      }
    },
    [checkOllama, ollamaStatus?.available, updateSetting],
  );

  const extraInstalledModels = (ollamaStatus?.models ?? []).filter(
    (m) => !OLLAMA_MODEL_OPTIONS.some((option) => option.tag === m),
  );

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-bg-card p-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-text-primary">AI summaries</p>
            <p className="text-xs text-text-secondary mt-1">
              {aiEnabled
                ? "Enabled. Summaries are generated after transcription."
                : "Disabled. Frajola will keep transcript-only mode."}
            </p>
          </div>
          <button
            onClick={() => updateSetting("ai_enabled", aiEnabled ? "0" : "1")}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              aiEnabled
                ? "bg-accent text-white hover:bg-accent/90"
                : "border border-border text-text-secondary hover:bg-bg-card-hover"
            }`}
          >
            {aiEnabled ? "Disable" : "Enable"}
          </button>
        </div>
      </div>

      {!aiEnabled && (
        <div className="rounded-lg border border-border bg-bg-card p-3 text-xs text-text-secondary">
          AI provider options are hidden while summaries are disabled.
        </div>
      )}

      <div className={aiEnabled ? "" : "opacity-50 pointer-events-none"}>
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

      {provider === "openai" && (
        <SelectField
          label="Model"
          value={model || "gpt-4o-mini"}
          options={[
            { value: "gpt-4o-mini", label: "GPT-4o Mini" },
            { value: "gpt-4o", label: "GPT-4o" },
            { value: "gpt-4.1", label: "GPT-4.1" },
            { value: "gpt-4.1-mini", label: "GPT-4.1 Mini" },
            { value: "gpt-4.1-nano", label: "GPT-4.1 Nano" },
          ]}
          onChange={(v) => updateSetting("ai_model", v)}
        />
      )}

      {provider === "anthropic" && (
        <SelectField
          label="Model"
          value={model || "claude-haiku-4-5-20251001"}
          options={[
            { value: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5" },
            { value: "claude-sonnet-4-6-20250514", label: "Claude Sonnet 4.6" },
            { value: "claude-opus-4-6-20250514", label: "Claude Opus 4.6" },
          ]}
          onChange={(v) => updateSetting("ai_model", v)}
        />
      )}

      {provider === "ollama" && (
        <>
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
          </div>

          {ollamaStatus?.available ? (
          <div className="space-y-3">
            <FieldLabel>Ollama Models</FieldLabel>
            <div className="space-y-2">
              {OLLAMA_MODEL_OPTIONS.map((option) => {
                const isSelected = model === option.tag;
                const isInstalled = isOllamaModelInstalled(option.tag);
                const isPulling = pullingModel === option.tag;

                return (
                  <div
                    key={option.tag}
                    onClick={() => {
                      if (isInstalled) {
                        updateSetting("ai_model", option.tag);
                      }
                    }}
                    className={`flex items-center justify-between rounded-lg border px-3 py-2.5 transition-colors ${
                      isSelected && isInstalled
                        ? "border-accent bg-accent/5"
                        : "border-border bg-bg-card hover:bg-bg-card-hover"
                    } ${isInstalled ? "cursor-pointer" : "cursor-default"}`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-medium text-text-primary">{option.label}</span>
                      <span className="text-xs text-text-tertiary">{option.sizeLabel}</span>
                      {isSelected && isInstalled && (
                        <span className="text-[10px] font-medium text-accent bg-accent/10 px-1.5 py-0.5 rounded">
                          Active
                        </span>
                      )}
                    </div>

                    <div className="flex items-center shrink-0 ml-2">
                      {isPulling ? (
                        <CircularProgress percent={pullPercent} />
                      ) : isInstalled ? (
                        <span className="text-[10px] font-medium text-green-400 bg-green-400/10 px-1.5 py-0.5 rounded">
                          Installed
                        </span>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            void handlePullOllamaModel(option.tag);
                          }}
                          disabled={pullingModel !== null || !ollamaStatus?.available}
                          className="flex h-6 w-6 items-center justify-center rounded-md text-text-tertiary hover:text-accent hover:bg-accent/10 transition-colors disabled:opacity-30"
                          title="Download model"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="7 10 12 15 17 10" />
                            <line x1="12" y1="15" x2="12" y2="3" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {extraInstalledModels.length > 0 && (
              <div className="space-y-2">
                <FieldLabel>Other Installed Models</FieldLabel>
                {extraInstalledModels.map((installedModel) => {
                  const isSelected = model === installedModel;
                  return (
                    <div
                      key={installedModel}
                      onClick={() => updateSetting("ai_model", installedModel)}
                      className={`flex cursor-pointer items-center justify-between rounded-lg border px-3 py-2.5 transition-colors ${
                        isSelected
                          ? "border-accent bg-accent/5"
                          : "border-border bg-bg-card hover:bg-bg-card-hover"
                      }`}
                    >
                      <span className="text-sm font-medium text-text-primary">{installedModel}</span>
                      {isSelected && (
                        <span className="text-[10px] font-medium text-accent bg-accent/10 px-1.5 py-0.5 rounded">
                          Active
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="rounded-lg border border-border bg-bg-card p-3 space-y-2">
              <FieldLabel>Custom Model Tag</FieldLabel>
              <input
                value={customModel}
                onChange={(e) => setCustomModel(e.target.value)}
                placeholder="qwen3.5:4b"
                className="w-full rounded-lg border border-border bg-bg-card px-3 py-2 text-sm text-text-primary outline-none focus:border-accent placeholder:text-text-muted"
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const tag = customModel.trim();
                    if (!tag) return;
                    updateSetting("ai_model", tag);
                  }}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium border border-border text-text-secondary hover:bg-bg-card-hover transition-colors"
                >
                  Set Active
                </button>
                <button
                  onClick={() => void handlePullOllamaModel(customModel)}
                  disabled={!customModel.trim() || pullingModel !== null || !ollamaStatus?.available}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-white bg-accent hover:bg-accent/90 transition-colors disabled:opacity-40"
                >
                  Download
                </button>
                {isOllamaModelInstalled(customModel) && (
                  <span className="text-[10px] font-medium text-green-400 bg-green-400/10 px-1.5 py-0.5 rounded">
                    Installed
                  </span>
                )}
              </div>
            </div>

            {pullingModel && (
              <div className="rounded-lg border border-border bg-bg-card p-3 space-y-2">
                <p className="text-xs text-text-secondary">
                  {pullStatus || "Downloading model..."} ({pullPercent}%)
                </p>
                <ProgressInlineBar percent={pullPercent} />
              </div>
            )}

            {modelActionError && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-400">
                {modelActionError}
              </div>
            )}
          </div>
          ) : (
          <OllamaSetup checkOllama={checkOllama} checkingOllama={checkingOllama} />
          )}
        </>
      )}

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
      </div>
    </div>
  );
}

/* ── Ollama Setup CTA ── */

function OllamaSetup({
  checkOllama,
  checkingOllama,
}: {
  checkOllama: () => Promise<void>;
  checkingOllama: boolean;
}) {
  const [installing, setInstalling] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleInstall = async () => {
    setInstalling(true);
    setMessage(null);
    try {
      const result = await invoke<{ installed: boolean; requires_manual: boolean; message: string }>("install_ollama");
      setMessage(result.message);
      if (result.installed) {
        // Give Ollama a moment to start, then re-check
        setTimeout(() => void checkOllama(), 3000);
      }
    } catch (err) {
      setMessage(String(err));
    } finally {
      setInstalling(false);
    }
  };

  const handleStart = async () => {
    setMessage(null);
    try {
      await invoke("start_ollama");
      setMessage("Starting Ollama...");
      setTimeout(() => void checkOllama(), 3000);
    } catch (err) {
      setMessage(String(err));
    }
  };

  return (
    <div className="rounded-lg border border-border bg-bg-card p-4 space-y-3">
      <p className="text-sm text-text-secondary">
        Ollama is not running. Install or start it to use local AI models.
      </p>
      <div className="flex items-center gap-2">
        <button
          onClick={handleInstall}
          disabled={installing}
          className="rounded-lg px-3 py-1.5 text-xs font-medium text-white bg-accent hover:bg-accent/90 transition-colors disabled:opacity-50"
        >
          {installing ? "Setting up..." : "Complete Ollama Setup"}
        </button>
        <button
          onClick={handleStart}
          className="rounded-lg px-3 py-1.5 text-xs font-medium border border-border text-text-secondary hover:bg-bg-card-hover transition-colors"
        >
          Start Ollama
        </button>
        <button
          onClick={checkOllama}
          disabled={checkingOllama}
          className="text-xs text-accent hover:text-accent/80 transition-colors disabled:opacity-50"
        >
          Refresh
        </button>
      </div>
      {message && (
        <p className="text-xs text-text-tertiary">{message}</p>
      )}
    </div>
  );
}

/* ── Circular Progress ── */

function CircularProgress({ percent, size = 20 }: { percent: number; size?: number }) {
  const strokeWidth = 2.5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <svg width={size} height={size} className="shrink-0 -rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="text-border"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="text-accent transition-[stroke-dashoffset] duration-200"
      />
    </svg>
  );
}

function ProgressInlineBar({ percent }: { percent: number }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full border border-border bg-bg-card">
      <div
        className="h-full bg-accent transition-all duration-200"
        style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
      />
    </div>
  );
}

/* ── Confirmation Dialog ── */

function ConfirmDialog({
  title,
  message,
  confirmLabel,
  variant = "default",
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  variant?: "default" | "danger";
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center" onClick={onCancel}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative z-10 w-[320px] rounded-xl border border-border bg-surface p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-semibold text-text-primary mb-2">{title}</h3>
        <p className="text-xs text-text-secondary mb-4 whitespace-pre-line">{message}</p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-bg-card transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-colors ${
              variant === "danger"
                ? "bg-red-500 hover:bg-red-600"
                : "bg-accent hover:bg-accent/90"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Transcription Settings ── */

function TranscriptionSettings({ getSetting, updateSetting }: SettingsSectionProps) {
  const selectedModel = getSetting("whisper_model") ?? "base";
  const [models, setModels] = useState<WhisperModel[]>([]);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [downloadPercent, setDownloadPercent] = useState(0);
  const [confirmDownload, setConfirmDownload] = useState<WhisperModel | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<WhisperModel | null>(null);

  const loadModels = useCallback(async () => {
    try {
      const result = await invoke<WhisperModel[]>("get_whisper_models");
      setModels(result);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadModels();
  }, [loadModels]);

  // Listen for download progress events
  useEffect(() => {
    if (!downloading) return;

    const unlisten = listen<{ model: string; percent: number }>(
      "model-download-progress",
      (event) => {
        if (event.payload.model === downloading) {
          setDownloadPercent(event.payload.percent);
        }
      }
    );

    return () => {
      unlisten.then((f) => f());
    };
  }, [downloading]);

  const handleDownload = async (model: WhisperModel) => {
    setConfirmDownload(null);
    setDownloading(model.key);
    setDownloadPercent(0);
    try {
      await invoke("download_model", { modelKey: model.key });
      await loadModels();
    } catch {
      // ignore
    }
    setDownloading(null);
    setDownloadPercent(0);
  };

  const handleDelete = async (model: WhisperModel) => {
    setConfirmDelete(null);
    try {
      await invoke("delete_whisper_model", { modelKey: model.key });
      await loadModels();
      // If the deleted model was selected, switch to first downloaded or base
      if (model.key === selectedModel) {
        const updated = await invoke<WhisperModel[]>("get_whisper_models");
        const firstDownloaded = updated.find((m) => m.downloaded);
        await updateSetting("whisper_model", firstDownloaded?.key ?? "base");
      }
    } catch {
      // ignore
    }
  };

  const handleSelect = (modelKey: string) => {
    const model = models.find((m) => m.key === modelKey);
    if (model?.downloaded) {
      updateSetting("whisper_model", modelKey);
    }
  };

  return (
    <>
      <div className="space-y-3">
        <FieldLabel>Whisper Model</FieldLabel>
        <div className="space-y-2">
          {models.map((model) => {
            const isSelected = model.key === selectedModel;
            const isDownloading = downloading === model.key;

            return (
              <div
                key={model.key}
                onClick={() => handleSelect(model.key)}
                className={`flex items-center justify-between rounded-lg border px-3 py-2.5 transition-colors ${
                  isSelected && model.downloaded
                    ? "border-accent bg-accent/5"
                    : "border-border bg-bg-card hover:bg-bg-card-hover"
                } ${model.downloaded ? "cursor-pointer" : "cursor-default"}`}
              >
                {/* Left: name + size */}
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-medium text-text-primary">{model.label}</span>
                  <span className="text-xs text-text-tertiary">{model.size_label}</span>
                  {isSelected && model.downloaded && (
                    <span className="text-[10px] font-medium text-accent bg-accent/10 px-1.5 py-0.5 rounded">
                      Active
                    </span>
                  )}
                </div>

                {/* Right: action */}
                <div className="flex items-center shrink-0 ml-2">
                  {isDownloading ? (
                    <CircularProgress percent={downloadPercent} />
                  ) : model.downloaded ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmDelete(model);
                      }}
                      className="flex h-6 w-6 items-center justify-center rounded-md text-text-tertiary hover:text-red-400 hover:bg-red-400/10 transition-colors"
                      title="Delete model"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmDownload(model);
                      }}
                      disabled={downloading !== null}
                      className="flex h-6 w-6 items-center justify-center rounded-md text-text-tertiary hover:text-accent hover:bg-accent/10 transition-colors disabled:opacity-30"
                      title="Download model"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Dialogs rendered outside the space-y container to avoid layout shift */}
      {confirmDownload && (
        <ConfirmDialog
          title="Download Model"
          message={`Download ${confirmDownload.label} model?\nSize: ${confirmDownload.size_label}`}
          confirmLabel="Download"
          onConfirm={() => handleDownload(confirmDownload)}
          onCancel={() => setConfirmDownload(null)}
        />
      )}
      {confirmDelete && (
        <ConfirmDialog
          title="Delete Model"
          message={`Delete ${confirmDelete.label} model (${confirmDelete.size_label})?\nThis will free up disk space. You can re-download it later.`}
          confirmLabel="Delete"
          variant="danger"
          onConfirm={() => handleDelete(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </>
  );
}
