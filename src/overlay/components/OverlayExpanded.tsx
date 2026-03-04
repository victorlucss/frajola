import { useState, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "../../lib/tauri";
import type { RecordingStatus } from "../../hooks/useRecording";
import type { DetectedMeeting } from "../types";
import frajolaLogo from "../../../assets/frajola.png";

interface AudioDevice {
  id: string;
  name: string;
  is_default: boolean;
  device_type: "input" | "output";
}

interface Props {
  status: RecordingStatus;
  elapsedSeconds: number;
  meetings: DetectedMeeting[];
  error: string | null;
  onCollapse: () => void;
  onStartRecording: (micDeviceId?: string) => Promise<void>;
  onStopRecording: () => Promise<void>;
  onPauseRecording: () => Promise<void>;
  onResumeRecording: () => Promise<void>;
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export default function OverlayExpanded({
  status,
  elapsedSeconds,
  meetings,
  error,
  onCollapse,
  onStartRecording,
  onStopRecording,
  onPauseRecording,
  onResumeRecording,
}: Props) {
  const [devices, setDevices] = useState<AudioDevice[]>([]);
  const [selectedMic, setSelectedMic] = useState<string>("");

  useEffect(() => {
    invoke<AudioDevice[]>("list_audio_devices").then((devs) => {
      const inputs = devs.filter((d) => d.device_type === "input");
      setDevices(inputs);
      const def = inputs.find((d) => d.is_default);
      if (def) setSelectedMic(def.id);
    }).catch(() => {});
  }, []);

  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-[10px] border border-border bg-bg-elevated/95 backdrop-blur-md">
      {/* Header — draggable */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-grab active:cursor-grabbing"
        onMouseDown={() => getCurrentWindow().startDragging()}
      >
        <span className="flex items-center gap-1.5 text-sm font-semibold text-text-primary">
          <img src={frajolaLogo} alt="" className="h-4 w-4 rounded-sm" />
          Frajola
        </span>
        <button
          onClick={onCollapse}
          className="flex h-6 w-6 items-center justify-center rounded-md text-text-tertiary hover:bg-bg-card hover:text-text-secondary transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="18 15 12 9 6 15" />
          </svg>
        </button>
      </div>

      {/* Meeting info */}
      {meetings.length > 0 && (
        <div className="px-4 pb-2">
          {meetings.map((m) => (
            <div key={m.app_name} className="flex items-center gap-2 text-xs text-text-secondary">
              <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
              {m.app_name}
            </div>
          ))}
        </div>
      )}

      {/* Timer */}
      {status !== "idle" && status !== "stopping" && (
        <div className="px-4 py-3 text-center">
          <div className="font-mono text-3xl font-semibold text-text-primary">
            {formatTime(elapsedSeconds)}
          </div>
          {status === "paused" && (
            <div className="mt-1 text-xs text-yellow-400">Paused</div>
          )}
        </div>
      )}

      {/* Mic picker — only when idle */}
      {status === "idle" && devices.length > 0 && (
        <div className="px-4 pb-2">
          <select
            value={selectedMic}
            onChange={(e) => setSelectedMic(e.target.value)}
            className="w-full rounded-lg border border-border bg-bg-card px-3 py-1.5 text-xs text-text-primary outline-none focus:border-accent"
          >
            {devices.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}{d.is_default ? " (default)" : ""}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center justify-center gap-2 px-4 py-3">
        {status === "idle" && (
          <button
            onClick={() => onStartRecording(selectedMic || undefined)}
            className="flex-1 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-bg transition-colors hover:bg-accent-dim"
          >
            Record
          </button>
        )}

        {status === "recording" && (
          <>
            <button
              onClick={onPauseRecording}
              className="flex-1 rounded-lg border border-border bg-bg-card px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-bg-card-hover"
            >
              Pause
            </button>
            <button
              onClick={onStopRecording}
              className="flex-1 rounded-lg bg-red-500/20 px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/30"
            >
              Stop
            </button>
          </>
        )}

        {status === "paused" && (
          <>
            <button
              onClick={onResumeRecording}
              className="flex-1 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-bg transition-colors hover:bg-accent-dim"
            >
              Resume
            </button>
            <button
              onClick={onStopRecording}
              className="flex-1 rounded-lg bg-red-500/20 px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/30"
            >
              Stop
            </button>
          </>
        )}

        {status === "stopping" && (
          <span className="text-sm text-text-tertiary">Stopping...</span>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 pb-3 text-xs text-red-400">{error}</div>
      )}
    </div>
  );
}
