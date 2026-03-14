import { useState, useEffect, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "../../lib/tauri";
import { FieldLabel, CircularProgress, ConfirmDialog } from "./fields";
import type { SettingsSectionProps } from "./types";

interface WhisperModel {
  key: string;
  label: string;
  size_label: string;
  downloaded: boolean;
}

export default function TranscriptionSettings({ getSetting, updateSetting }: SettingsSectionProps) {
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
