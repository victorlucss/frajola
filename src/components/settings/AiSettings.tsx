import { useState, useEffect, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "../../lib/tauri";
import { FieldLabel, SelectField, InputField, CircularProgress, ProgressInlineBar } from "./fields";
import type { SettingsSectionProps } from "./types";

interface OllamaStatus {
  available: boolean;
  models: string[];
}

interface OllamaModelOption {
  label: string;
  tag: string;
  sizeLabel: string;
}

const OLLAMA_MODEL_OPTIONS: OllamaModelOption[] = [
  { label: "Llama 3.2 1B", tag: "llama3.2:1b", sizeLabel: "~1.3 GB" },
  { label: "Qwen 2.5 3B", tag: "qwen2.5:3b", sizeLabel: "~2.0 GB" },
  { label: "Llama 3.2 3B", tag: "llama3.2:3b", sizeLabel: "~2.0 GB" },
  { label: "Qwen 3.5 4B", tag: "qwen3.5:4b", sizeLabel: "~3.0 GB" },
  { label: "Mistral 7B", tag: "mistral:7b", sizeLabel: "~4.1 GB" },
  { label: "Qwen 2.5 7B", tag: "qwen2.5:7b", sizeLabel: "~4.7 GB" },
  { label: "Llama 3.1 8B", tag: "llama3.1:8b", sizeLabel: "~4.9 GB" },
];

export default function AiSettings({ getSetting, updateSetting }: SettingsSectionProps) {
  const aiEnabled = (getSetting("ai_enabled") ?? "1") === "1";
  const provider = getSetting("ai_provider") ?? "ollama";
  const model = getSetting("ai_model") ?? "";
  const dictLlmEnabled = (getSetting("dictation_llm_enabled") ?? "0") === "1";
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

      {/* Dictation LLM Enhancement */}
      <div className="rounded-lg border border-border bg-bg-card p-3 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-text-primary">Dictation LLM Enhancement</p>
            <p className="text-xs text-text-secondary mt-1">Post-process dictation with an LLM for better accuracy.</p>
          </div>
          <button
            onClick={() => updateSetting("dictation_llm_enabled", dictLlmEnabled ? "0" : "1")}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              dictLlmEnabled
                ? "bg-accent text-white hover:bg-accent/90"
                : "border border-border text-text-secondary hover:bg-bg-card-hover"
            }`}
          >
            {dictLlmEnabled ? "On" : "Off"}
          </button>
        </div>

        {dictLlmEnabled && (
          <div className="space-y-3 pt-2 border-t border-border">
            <SelectField
              label="Provider"
              value={getSetting("dictation_llm_provider") ?? "ollama"}
              options={[
                { value: "ollama", label: "Ollama (Local)" },
                { value: "openai", label: "OpenAI" },
                { value: "anthropic", label: "Anthropic" },
              ]}
              onChange={(v) => updateSetting("dictation_llm_provider", v)}
            />
            <InputField
              label="Model"
              value={getSetting("dictation_llm_model") ?? "llama3.2"}
              placeholder="llama3.2"
              onChange={(v) => updateSetting("dictation_llm_model", v)}
            />
            {(getSetting("dictation_llm_provider") ?? "ollama") !== "ollama" && (
              <InputField
                label="API Key"
                type="password"
                value={getSetting("dictation_llm_api_key") ?? ""}
                placeholder={(getSetting("dictation_llm_provider") ?? "ollama") === "openai" ? "sk-..." : "sk-ant-..."}
                onChange={(v) => updateSetting("dictation_llm_api_key", v)}
              />
            )}
            <div>
              <FieldLabel>Correction Level: {getSetting("dictation_llm_correction_level") ?? "3"}</FieldLabel>
              <input
                type="range"
                min={1}
                max={5}
                value={Number(getSetting("dictation_llm_correction_level") ?? "3")}
                onChange={(e) => updateSetting("dictation_llm_correction_level", e.target.value)}
                className="w-full accent-accent"
              />
              <div className="flex justify-between text-[10px] text-text-tertiary">
                <span>Minimal</span>
                <span>Aggressive</span>
              </div>
            </div>
          </div>
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
