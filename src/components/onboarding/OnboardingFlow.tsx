import { useCallback, useEffect, useMemo, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "../../lib/tauri";

type SetupMode = "full_local" | "transcription_only";

type StepKey = "mode" | "permissions" | "whisper" | "ollama" | "finish";

interface WhisperModel {
  key: string;
  label: string;
  size_label: string;
  downloaded: boolean;
}

interface OllamaStatus {
  available: boolean;
  models: string[];
}

interface OllamaInstallResult {
  installed: boolean;
  requires_manual: boolean;
  message: string;
}

interface AudioPermissionStatus {
  microphone: boolean;
  system_audio: boolean;
  error: string | null;
}

interface Props {
  onComplete: () => void;
}

const RECOMMENDED_WHISPER = "base";
const RECOMMENDED_OLLAMA_MODEL = "llama3.2:3b";

interface OllamaModelOption {
  label: string;
  tag: string;
  size: string;
  quality: "Fast" | "Balanced" | "Higher quality";
}

const OLLAMA_MODEL_OPTIONS: OllamaModelOption[] = [
  {
    label: "Llama 3.2 1B",
    tag: "llama3.2:1b",
    size: "~1.3 GB",
    quality: "Fast",
  },
  {
    label: "Qwen 2.5 3B",
    tag: "qwen2.5:3b",
    size: "~2.0 GB",
    quality: "Fast",
  },
  {
    label: "Llama 3.2 3B",
    tag: "llama3.2:3b",
    size: "~2.0 GB",
    quality: "Balanced",
  },
  {
    label: "Qwen 3.5 4B",
    tag: "qwen3.5:4b",
    size: "~3.0 GB",
    quality: "Balanced",
  },
  {
    label: "Qwen 2.5 7B",
    tag: "qwen2.5:7b",
    size: "~4.7 GB",
    quality: "Higher quality",
  },
  {
    label: "Mistral 7B",
    tag: "mistral:7b",
    size: "~4.1 GB",
    quality: "Higher quality",
  },
  {
    label: "Llama 3.1 8B",
    tag: "llama3.1:8b",
    size: "~4.9 GB",
    quality: "Higher quality",
  },
];

function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="w-full rounded-full bg-bg-card h-2 overflow-hidden border border-border">
      <div
        className="h-full bg-accent transition-all duration-200"
        style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
      />
    </div>
  );
}

export default function OnboardingFlow({ onComplete }: Props) {
  const [mode, setMode] = useState<SetupMode>("full_local");
  const [stepIndex, setStepIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const [permissions, setPermissions] = useState<AudioPermissionStatus | null>(null);
  const [checkingPermissions, setCheckingPermissions] = useState(false);

  const [models, setModels] = useState<WhisperModel[]>([]);
  const [selectedWhisper, setSelectedWhisper] = useState(RECOMMENDED_WHISPER);
  const [downloadingWhisper, setDownloadingWhisper] = useState<string | null>(null);
  const [whisperProgress, setWhisperProgress] = useState(0);

  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus | null>(null);
  const [checkingOllama, setCheckingOllama] = useState(false);
  const [installingOllama, setInstallingOllama] = useState(false);
  const [installMessage, setInstallMessage] = useState<string | null>(null);
  const [pullingModel, setPullingModel] = useState(false);
  const [pullPercent, setPullPercent] = useState(0);
  const [pullStatus, setPullStatus] = useState<string>("Waiting");
  const [selectedPresetTag, setSelectedPresetTag] = useState(RECOMMENDED_OLLAMA_MODEL);
  const [customOllamaModel, setCustomOllamaModel] = useState("qwen3.5:4b");
  const [useCustomModel, setUseCustomModel] = useState(false);

  const [aiEnabledForFinish, setAiEnabledForFinish] = useState(true);

  const steps = useMemo<StepKey[]>(
    () => (mode === "full_local" ? ["mode", "permissions", "whisper", "ollama", "finish"] : ["mode", "permissions", "whisper", "finish"]),
    [mode],
  );

  const currentStep = steps[stepIndex];

  const selectedWhisperModel = useMemo(
    () => models.find((m) => m.key === selectedWhisper),
    [models, selectedWhisper],
  );

  const selectedOllamaModel = useMemo(() => {
    if (useCustomModel) {
      return customOllamaModel.trim();
    }
    return selectedPresetTag;
  }, [useCustomModel, customOllamaModel, selectedPresetTag]);

  const selectedPreset = useMemo(
    () => OLLAMA_MODEL_OPTIONS.find((m) => m.tag === selectedPresetTag) ?? null,
    [selectedPresetTag],
  );

  const isSelectedOllamaModelInstalled = useMemo(() => {
    if (!ollamaStatus?.models || !selectedOllamaModel) return false;
    const selected = selectedOllamaModel.toLowerCase();
    return ollamaStatus.models.some((m) => {
      const installed = m.toLowerCase();
      return installed === selected || installed.startsWith(`${selected}:`);
    });
  }, [ollamaStatus, selectedOllamaModel]);

  const next = useCallback(() => {
    setError(null);
    setStepIndex((s) => Math.min(s + 1, steps.length - 1));
  }, [steps.length]);

  const back = useCallback(() => {
    setError(null);
    setStepIndex((s) => Math.max(s - 1, 0));
  }, []);

  const loadModels = useCallback(async () => {
    const result = await invoke<WhisperModel[]>("get_whisper_models");
    setModels(result);
    if (!result.some((m) => m.key === selectedWhisper)) {
      setSelectedWhisper(RECOMMENDED_WHISPER);
    }
  }, [selectedWhisper]);

  const checkPermissions = useCallback(async () => {
    setCheckingPermissions(true);
    setError(null);
    try {
      const status = await invoke<AudioPermissionStatus>("check_audio_permissions");
      setPermissions(status);
    } catch (err) {
      setError(String(err));
    }
    setCheckingPermissions(false);
  }, []);

  const checkOllama = useCallback(async () => {
    setCheckingOllama(true);
    setError(null);
    try {
      const status = await invoke<OllamaStatus>("check_ollama_status");
      setOllamaStatus(status);
    } catch (err) {
      setError(String(err));
      setOllamaStatus({ available: false, models: [] });
    }
    setCheckingOllama(false);
  }, []);

  useEffect(() => {
    if (currentStep === "permissions") {
      void checkPermissions();
    }
    if (currentStep === "whisper") {
      void loadModels();
    }
    if (currentStep === "ollama") {
      void checkOllama();
    }
  }, [currentStep, checkPermissions, loadModels, checkOllama]);

  useEffect(() => {
    if (currentStep !== "permissions") return;

    const onFocus = () => {
      void checkPermissions();
    };

    const onVisibilityChange = () => {
      if (!document.hidden) {
        void checkPermissions();
      }
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [currentStep, checkPermissions]);

  useEffect(() => {
    if (!downloadingWhisper) return;

    const unlisten = listen<{ model: string; percent: number }>("model-download-progress", (event) => {
      if (event.payload.model === downloadingWhisper) {
        setWhisperProgress(event.payload.percent);
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [downloadingWhisper]);

  useEffect(() => {
    if (!pullingModel) return;

    const unlisten = listen<{ model: string; status: string; percent: number; done: boolean }>("ollama-pull-progress", (event) => {
      const payload = event.payload;
      if (payload.model === selectedOllamaModel || payload.model.startsWith(`${selectedOllamaModel}:`)) {
        setPullStatus(payload.status || "Pulling");
        setPullPercent(payload.percent ?? 0);
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [pullingModel, selectedOllamaModel]);

  const handleModeNext = async () => {
    setAiEnabledForFinish(mode === "full_local");
    next();
  };

  const handleWhisperContinue = async () => {
    setError(null);

    if (!selectedWhisperModel) {
      setError("Choose a Whisper model to continue.");
      return;
    }

    try {
      if (!selectedWhisperModel.downloaded) {
        setDownloadingWhisper(selectedWhisperModel.key);
        setWhisperProgress(0);
        await invoke("download_model", { modelKey: selectedWhisperModel.key });
      }

      await invoke("set_setting", { key: "whisper_model", value: selectedWhisperModel.key });
      await loadModels();
      setDownloadingWhisper(null);
      setWhisperProgress(0);
      next();
    } catch (err) {
      setDownloadingWhisper(null);
      setWhisperProgress(0);
      setError(String(err));
    }
  };

  const handleInstallOllama = async () => {
    setInstallingOllama(true);
    setError(null);
    try {
      const result = await invoke<OllamaInstallResult>("install_ollama");
      setInstallMessage(result.message);
      await checkOllama();
    } catch (err) {
      setError(String(err));
    }
    setInstallingOllama(false);
  };

  const handleStartOllama = async () => {
    setError(null);
    try {
      await invoke("start_ollama");
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await checkOllama();
    } catch (err) {
      setError(String(err));
    }
  };

  const handlePullModel = async () => {
    if (!selectedOllamaModel) {
      setError("Choose a model tag before downloading.");
      return;
    }

    setPullingModel(true);
    setPullPercent(0);
    setPullStatus("Starting download...");
    setError(null);

    try {
      await invoke("pull_ollama_model", { model: selectedOllamaModel });
      await checkOllama();
    } catch (err) {
      setError(String(err));
    }

    setPullingModel(false);
  };

  const finishOnboarding = async (aiEnabled: boolean) => {
    setError(null);

    try {
      await invoke("set_setting", { key: "setup_mode", value: aiEnabled ? "full_local" : "transcription_only" });
      await invoke("set_setting", { key: "ai_enabled", value: aiEnabled ? "1" : "0" });

      if (aiEnabled) {
        if (!selectedOllamaModel) {
          setError("Choose an AI model to continue.");
          return;
        }
        await invoke("set_setting", { key: "ai_provider", value: "ollama" });
        await invoke("set_setting", { key: "ai_model", value: selectedOllamaModel });
      }

      await invoke("set_setting", { key: "onboarding_completed", value: "1" });
      onComplete();
    } catch (err) {
      setError(String(err));
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-3xl rounded-2xl border border-border bg-surface shadow-2xl overflow-hidden">
        <div className="border-b border-border px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-text-tertiary">Welcome to Frajola</p>
              <h2 className="text-xl font-semibold text-text-primary">Set up your workspace</h2>
            </div>
            <p className="text-xs text-text-tertiary">
              Step {stepIndex + 1} of {steps.length}
            </p>
          </div>
          <div className="mt-3">
            <ProgressBar percent={((stepIndex + 1) / steps.length) * 100} />
          </div>
        </div>

        <div className="p-6 min-h-[360px]">
          {currentStep === "mode" && (
            <div className="space-y-5">
              <div>
                <h3 className="text-lg font-semibold text-text-primary">Choose your setup mode</h3>
                <p className="text-sm text-text-secondary mt-1">
                  You can change this later in Settings.
                </p>
              </div>

              <div className="grid gap-3">
                <button
                  onClick={() => setMode("full_local")}
                  className={`rounded-xl border p-4 text-left transition-colors ${
                    mode === "full_local"
                      ? "border-accent bg-accent/10"
                      : "border-border bg-bg-card hover:bg-bg-card-hover"
                  }`}
                >
                  <p className="text-sm font-semibold text-text-primary">Full Local (Recommended)</p>
                  <p className="text-xs text-text-secondary mt-1">
                    Local transcription + local AI summaries with Ollama.
                  </p>
                </button>

                <button
                  onClick={() => setMode("transcription_only")}
                  className={`rounded-xl border p-4 text-left transition-colors ${
                    mode === "transcription_only"
                      ? "border-accent bg-accent/10"
                      : "border-border bg-bg-card hover:bg-bg-card-hover"
                  }`}
                >
                  <p className="text-sm font-semibold text-text-primary">Transcription Only</p>
                  <p className="text-xs text-text-secondary mt-1">
                    Skip AI for now and keep only local transcription.
                  </p>
                </button>
              </div>
            </div>
          )}

          {currentStep === "permissions" && (
            <div className="space-y-5">
              <div>
                <h3 className="text-lg font-semibold text-text-primary">Grant macOS permissions</h3>
                <p className="text-sm text-text-secondary mt-1">
                  Frajola needs microphone and screen/system audio permissions to capture meetings.
                </p>
              </div>

              <div className="grid gap-3">
                <div className="rounded-xl border border-border bg-bg-card p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-text-primary">Microphone</p>
                    <p className="text-xs text-text-secondary mt-1">Required to capture your voice.</p>
                    <p className={`text-xs mt-2 ${permissions?.microphone ? "text-green-400" : "text-red-400"}`}>
                      {checkingPermissions
                        ? "Checking status..."
                        : permissions?.microphone
                          ? "Granted"
                          : "Not granted"}
                    </p>
                  </div>
                  <button
                    onClick={() => invoke("open_microphone_permission_settings")}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/10 transition-colors"
                  >
                    Open Settings
                  </button>
                </div>

                <div className="rounded-xl border border-border bg-bg-card p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-text-primary">Screen & System Audio</p>
                    <p className="text-xs text-text-secondary mt-1">Required to capture other participants.</p>
                    <p className={`text-xs mt-2 ${permissions?.system_audio ? "text-green-400" : "text-red-400"}`}>
                      {checkingPermissions
                        ? "Checking status..."
                        : permissions?.system_audio
                          ? "Granted"
                          : "Not granted"}
                    </p>
                  </div>
                  <button
                    onClick={() => invoke("open_audio_permission_settings")}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/10 transition-colors"
                  >
                    Open Settings
                  </button>
                </div>
                <div className="rounded-xl border border-border bg-bg-card p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-text-primary">Status refresh</p>
                    <p className="text-xs text-text-secondary mt-1">
                      We automatically re-check when you return from System Settings.
                    </p>
                  </div>
                  <button
                    onClick={checkPermissions}
                    disabled={checkingPermissions}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-white bg-accent hover:bg-accent/90 transition-colors disabled:opacity-50"
                  >
                    {checkingPermissions ? "Checking..." : "Refresh"}
                  </button>
                </div>
              </div>

              {permissions?.error && (
                <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-400">
                  {permissions.error}
                </div>
              )}
            </div>
          )}

          {currentStep === "whisper" && (
            <div className="space-y-5">
              <div>
                <h3 className="text-lg font-semibold text-text-primary">Choose your Whisper model</h3>
                <p className="text-sm text-text-secondary mt-1">
                  We recommend Base for the best speed and quality balance.
                </p>
              </div>

              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                {models.map((model) => (
                  <button
                    key={model.key}
                    onClick={() => setSelectedWhisper(model.key)}
                    className={`w-full rounded-xl border p-3 text-left transition-colors ${
                      selectedWhisper === model.key
                        ? "border-accent bg-accent/10"
                        : "border-border bg-bg-card hover:bg-bg-card-hover"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-text-primary">{model.label}</p>
                        {model.key === RECOMMENDED_WHISPER && (
                          <span className="rounded bg-accent/15 px-1.5 py-0.5 text-[10px] font-medium text-accent">Recommended</span>
                        )}
                      </div>
                      <p className="text-xs text-text-tertiary">{model.size_label}</p>
                    </div>
                    <p className="text-xs mt-1 text-text-secondary">
                      {model.downloaded ? "Already downloaded" : "Will be downloaded in this step"}
                    </p>
                  </button>
                ))}
              </div>

              {downloadingWhisper && (
                <div className="rounded-xl border border-border bg-bg-card p-3 space-y-2">
                  <p className="text-xs text-text-secondary">Downloading Whisper model... {whisperProgress}%</p>
                  <ProgressBar percent={whisperProgress} />
                </div>
              )}
            </div>
          )}

          {currentStep === "ollama" && (
            <div className="space-y-5">
              <div>
                <h3 className="text-lg font-semibold text-text-primary">Set up local AI (Ollama)</h3>
                <p className="text-sm text-text-secondary mt-1">
                  Install Ollama, then download model <span className="font-medium text-text-primary">{selectedOllamaModel}</span>.
                </p>
              </div>

              <div className="rounded-xl border border-border bg-bg-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-text-primary">Ollama status</p>
                    <p className="text-xs text-text-secondary mt-1">
                      {checkingOllama
                        ? "Checking..."
                        : ollamaStatus?.available
                          ? `Connected (${ollamaStatus.models.length} models found)`
                          : "Not running or not installed"}
                    </p>
                  </div>
                  <button
                    onClick={checkOllama}
                    disabled={checkingOllama}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/10 transition-colors disabled:opacity-50"
                  >
                    Refresh
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={handleInstallOllama}
                    disabled={installingOllama}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-white bg-accent hover:bg-accent/90 transition-colors disabled:opacity-50"
                  >
                    {installingOllama ? "Installing..." : "Install Ollama"}
                  </button>
                  <button
                    onClick={handleStartOllama}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-bg-card-hover transition-colors border border-border"
                  >
                    Start Ollama
                  </button>
                </div>

                {installMessage && <p className="text-xs text-text-secondary">{installMessage}</p>}
              </div>

              <div className="rounded-xl border border-border bg-bg-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-text-primary">Choose model (light to heavy)</p>
                    <p className="text-xs text-text-secondary mt-1">
                      Selected: <span className="text-text-primary">{selectedOllamaModel || "none"}</span>
                    </p>
                    {selectedPreset && !useCustomModel && (
                      <p className="text-xs text-text-secondary mt-1">
                        {selectedPreset.size} • {selectedPreset.quality}
                      </p>
                    )}
                  </div>
                  {isSelectedOllamaModelInstalled ? (
                    <span className="rounded bg-green-500/15 px-2 py-1 text-[10px] font-medium text-green-400">Installed</span>
                  ) : (
                    <button
                      onClick={handlePullModel}
                      disabled={!ollamaStatus?.available || pullingModel || !selectedOllamaModel}
                      className="rounded-lg px-3 py-1.5 text-xs font-medium text-white bg-accent hover:bg-accent/90 transition-colors disabled:opacity-50"
                    >
                      {pullingModel ? "Downloading..." : "Download model"}
                    </button>
                  )}
                </div>

                <div className="max-h-[220px] overflow-y-auto pr-1 space-y-2">
                  {OLLAMA_MODEL_OPTIONS.map((option) => (
                    <button
                      key={option.tag}
                      onClick={() => {
                        setUseCustomModel(false);
                        setSelectedPresetTag(option.tag);
                      }}
                      className={`w-full rounded-lg border p-3 text-left transition-colors ${
                        !useCustomModel && selectedPresetTag === option.tag
                          ? "border-accent bg-accent/10"
                          : "border-border hover:bg-bg-card-hover"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-text-primary">{option.label}</p>
                          {option.tag === RECOMMENDED_OLLAMA_MODEL && (
                            <span className="rounded bg-accent/15 px-1.5 py-0.5 text-[10px] font-medium text-accent">
                              Recommended
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-text-tertiary">{option.size}</p>
                      </div>
                      <p className="text-xs text-text-secondary mt-1">
                        {option.tag} • {option.quality}
                      </p>
                    </button>
                  ))}
                </div>

                <div className="rounded-lg border border-border p-3 space-y-2">
                  <label className="flex items-center gap-2 text-xs text-text-secondary">
                    <input
                      type="checkbox"
                      checked={useCustomModel}
                      onChange={(e) => setUseCustomModel(e.target.checked)}
                    />
                    Use custom model tag (for example: qwen3.5:4b)
                  </label>
                  {useCustomModel && (
                    <input
                      value={customOllamaModel}
                      onChange={(e) => setCustomOllamaModel(e.target.value)}
                      placeholder="qwen3.5:4b"
                      className="w-full rounded-lg border border-border bg-bg-card px-3 py-2 text-sm text-text-primary outline-none focus:border-accent placeholder:text-text-muted"
                    />
                  )}
                </div>

                {(pullingModel || pullPercent > 0) && (
                  <div className="space-y-2">
                    <p className="text-xs text-text-secondary">
                      {pullStatus} ({pullPercent}%)
                    </p>
                    <ProgressBar percent={pullPercent} />
                  </div>
                )}
              </div>
            </div>
          )}

          {currentStep === "finish" && (
            <div className="space-y-5">
              <div>
                <h3 className="text-lg font-semibold text-text-primary">You are ready</h3>
                <p className="text-sm text-text-secondary mt-1">
                  Frajola is configured and ready to record your meetings.
                </p>
              </div>

              <div className="rounded-xl border border-border bg-bg-card p-4 space-y-1 text-xs">
                <p className="text-text-secondary">
                  Setup mode: <span className="text-text-primary font-medium">{aiEnabledForFinish ? "Full Local" : "Transcription Only"}</span>
                </p>
                <p className="text-text-secondary">
                  Whisper model: <span className="text-text-primary font-medium">{selectedWhisper}</span>
                </p>
                <p className="text-text-secondary">
                  AI summaries: <span className="text-text-primary font-medium">{aiEnabledForFinish ? "Enabled" : "Disabled"}</span>
                </p>
                {aiEnabledForFinish && (
                  <p className="text-text-secondary">
                    AI model: <span className="text-text-primary font-medium">{selectedOllamaModel}</span>
                  </p>
                )}
              </div>

              <div className="rounded-xl border border-border bg-bg-card p-4 space-y-2">
                <p className="text-sm font-medium text-text-primary">Use Frajola with only the overlay</p>
                <p className="text-xs text-text-secondary">
                  You can keep the app out of the way and control recording from the floating overlay.
                </p>
                <ol className="list-decimal pl-4 space-y-1 text-xs text-text-secondary">
                  <li>Minimize the main window (<span className="text-text-primary">Cmd+M</span>) and the overlay appears.</li>
                  <li>Close the main window (red button) to hide it and keep overlay-only mode.</li>
                  <li>Click the Frajola dock icon anytime to bring the main window back.</li>
                </ol>
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-400">
              {error}
            </div>
          )}
        </div>

        <div className="border-t border-border px-6 py-4 flex items-center justify-between">
          <button
            onClick={back}
            disabled={stepIndex === 0}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-bg-card transition-colors disabled:opacity-40"
          >
            Back
          </button>

          <div className="flex items-center gap-2">
            {currentStep === "mode" && (
              <button
                onClick={handleModeNext}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-white bg-accent hover:bg-accent/90 transition-colors"
              >
                Continue
              </button>
            )}

            {currentStep === "permissions" && (
              <>
                <button
                  onClick={next}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-bg-card transition-colors"
                >
                  Continue Anyway
                </button>
                <button
                  onClick={next}
                  disabled={!permissions?.microphone || !permissions?.system_audio}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-white bg-accent hover:bg-accent/90 transition-colors disabled:opacity-40"
                >
                  Continue
                </button>
              </>
            )}

            {currentStep === "whisper" && (
              <button
                onClick={handleWhisperContinue}
                disabled={!!downloadingWhisper || models.length === 0}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-white bg-accent hover:bg-accent/90 transition-colors disabled:opacity-40"
              >
                {selectedWhisperModel?.downloaded ? "Save & Continue" : "Download & Continue"}
              </button>
            )}

            {currentStep === "ollama" && (
              <>
                <button
                  onClick={() => {
                    setAiEnabledForFinish(false);
                    next();
                  }}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-bg-card transition-colors"
                >
                  Skip AI for now
                </button>
                <button
                  onClick={() => {
                    setAiEnabledForFinish(true);
                    next();
                  }}
                  disabled={!isSelectedOllamaModelInstalled}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-white bg-accent hover:bg-accent/90 transition-colors disabled:opacity-40"
                >
                  Continue with AI
                </button>
              </>
            )}

            {currentStep === "finish" && (
              <button
                onClick={() => finishOnboarding(aiEnabledForFinish)}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-white bg-accent hover:bg-accent/90 transition-colors"
              >
                Start Using Frajola
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
