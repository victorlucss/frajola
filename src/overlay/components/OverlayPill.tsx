import { useState, useEffect, useRef } from "react";
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
  onExpand: () => void;
  onStartRecording: (micDeviceId?: string) => Promise<void>;
  onStopRecording: () => Promise<void>;
  onPauseRecording: () => Promise<void>;
  onResumeRecording: () => Promise<void>;
}

const ANIMATION_MS = 200;

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export default function OverlayPill({
  status,
  elapsedSeconds,
  onExpand,
  onStartRecording,
  onStopRecording,
  onPauseRecording,
  onResumeRecording,
}: Props) {
  const [devices, setDevices] = useState<AudioDevice[]>([]);
  const [selectedMic, setSelectedMic] = useState<string>("");
  const [hovered, setHovered] = useState(false);
  const iconPressRef = useRef<{
    startX: number;
    startY: number;
    dragged: boolean;
  } | null>(null);
  const isRecording = status === "recording" || status === "paused";

  useEffect(() => {
    invoke<AudioDevice[]>("list_audio_devices")
      .then((devs) => {
        const inputs = devs.filter((d) => d.device_type === "input");
        setDevices(inputs);
        const def = inputs.find((d) => d.is_default);
        if (def) setSelectedMic(def.id);
      })
      .catch(() => {});
  }, []);

  // Start compacted (just the icon)
  useEffect(() => {
    invoke("compact_overlay").catch(() => {});
  }, []);

  const handleMouseEnter = () => {
    setHovered(true);
    // Resize window to full pill width
    invoke("set_overlay_pill_width", { recording: isRecording }).catch(() => {});
  };

  const handleMouseLeave = () => {
    setHovered(false);
    // Shrink back to icon-only after animation
    setTimeout(() => {
      invoke("compact_overlay").catch(() => {});
    }, ANIMATION_MS);
  };

  const handleIconMouseDown = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    iconPressRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      dragged: false,
    };
  };

  const handleIconMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    const press = iconPressRef.current;
    if (!press || (e.buttons & 1) === 0) return;

    const movedX = Math.abs(e.clientX - press.startX);
    const movedY = Math.abs(e.clientY - press.startY);
    if (!press.dragged && (movedX > 3 || movedY > 3)) {
      press.dragged = true;
      void getCurrentWindow().startDragging();
    }
  };

  const handleIconMouseUp = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const press = iconPressRef.current;
    iconPressRef.current = null;
    if (press && !press.dragged) {
      onExpand();
    }
  };

  const handleIconDragStart = (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
  };

  return (
    <div
      className="h-full w-full"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div
        className={`flex h-full items-center overflow-hidden rounded-[10px] border border-white/[0.06] bg-bg-elevated/45 backdrop-blur-2xl select-none transition-all ease-in-out ${
          hovered
            ? "w-full px-1.5 gap-1 opacity-100 duration-200"
            : "w-[40px] px-0 gap-0 opacity-80 duration-200"
        }`}
        onMouseDown={() => getCurrentWindow().startDragging()}
      >
        {/* Frajola icon — click to expand */}
        <button
          onMouseDown={handleIconMouseDown}
          onMouseMove={handleIconMouseMove}
          onMouseUp={handleIconMouseUp}
          onDragStart={handleIconDragStart}
          className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-[10px] hover:bg-bg-card transition-colors"
        >
          <img src={frajolaLogo} alt="" draggable={false} className="h-7 w-7 rounded-sm" />
        </button>

        {hovered && isRecording ? (
          <>
            {/* Recording dot + timer */}
            <span className="flex items-center gap-1 shrink-0">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500 animate-pulse" />
              <span className="font-mono text-[11px] font-medium text-text-primary tabular-nums">
                {formatTime(elapsedSeconds)}
              </span>
            </span>

            {/* Pause/Resume */}
            <button
              onMouseDown={(e) => e.stopPropagation()}
              onClick={status === "paused" ? onResumeRecording : onPauseRecording}
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-text-secondary hover:bg-bg-card hover:text-text-primary transition-colors"
              title={status === "paused" ? "Resume" : "Pause"}
            >
              {status === "paused" ? (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5 3 19 12 5 21" />
                </svg>
              ) : (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="4" width="4" height="16" rx="1" />
                  <rect x="14" y="4" width="4" height="16" rx="1" />
                </svg>
              )}
            </button>

            {/* Stop */}
            <button
              onMouseDown={(e) => e.stopPropagation()}
              onClick={onStopRecording}
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
              title="Stop"
            >
              <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor">
                <rect x="4" y="4" width="16" height="16" rx="2" />
              </svg>
            </button>
          </>
        ) : hovered ? (
          <>
            {/* Mic icon with hidden select overlay */}
            <div className="relative shrink-0" onMouseDown={(e) => e.stopPropagation()}>
              <div className="flex h-6 w-6 items-center justify-center rounded-full text-text-tertiary hover:bg-bg-card hover:text-text-secondary transition-colors">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="2" width="6" height="11" rx="3" />
                  <path d="M5 10a7 7 0 0 0 14 0" />
                  <line x1="12" y1="19" x2="12" y2="22" />
                </svg>
              </div>
              {devices.length > 0 && (
                <select
                  value={selectedMic}
                  onChange={(e) => setSelectedMic(e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                >
                  {devices.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Red record button */}
            <button
              onMouseDown={(e) => e.stopPropagation()}
              onClick={() => onStartRecording(selectedMic || undefined)}
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-500 transition-colors hover:bg-red-600"
              title="Record"
            >
              <span className="h-2 w-2 rounded-full bg-white/90" />
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
