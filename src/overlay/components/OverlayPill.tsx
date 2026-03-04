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

const ANIM_MS = 280;
const PILL_COMPACT = 48;
const PILL_IDLE = 118;
const PILL_RECORDING = 160;

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
  const collapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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
    // Cancel any pending collapse
    if (collapseTimer.current) {
      clearTimeout(collapseTimer.current);
      collapseTimer.current = null;
    }
    // Expand window instantly to full width — it's transparent so invisible
    invoke("set_overlay_pill_width", { recording: isRecording }).catch(() => {});
    setHovered(true);
  };

  const handleMouseLeave = () => {
    setHovered(false);
    // Wait for CSS animation to finish, then shrink the window
    collapseTimer.current = setTimeout(() => {
      invoke("compact_overlay").catch(() => {});
      collapseTimer.current = null;
    }, ANIM_MS);
  };

  const pillWidth = hovered
    ? isRecording
      ? PILL_RECORDING
      : PILL_IDLE
    : PILL_COMPACT;

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
      {/* Clip wrapper — forces backdrop-blur to respect border-radius */}
      <div
        className="h-[48px] rounded-[13px] overflow-hidden transition-[width] duration-[280ms] ease-[cubic-bezier(0.25,0.1,0.25,1)]"
        style={{ width: pillWidth, willChange: "width" }}
      >
      <div
        className="flex h-full w-full items-center border border-white/[0.14] bg-[#131927d4] shadow-[0_16px_34px_rgba(0,0,0,0.45)] backdrop-blur-2xl select-none pl-1"
        onMouseDown={() => getCurrentWindow().startDragging()}
      >
        {/* Frajola icon — click to expand */}
        <button
          onMouseDown={handleIconMouseDown}
          onMouseMove={handleIconMouseMove}
          onMouseUp={handleIconMouseUp}
          onDragStart={handleIconDragStart}
          className="flex h-[37px] w-[37px] shrink-0 items-center justify-center rounded-[11px] transition-colors hover:bg-white/10"
        >
          <img src={frajolaLogo} alt="" draggable={false} className="h-[29px] w-[29px] rounded-sm" />
        </button>

        {/* Action tray — always rendered, clipped by pill overflow */}
        <div
          className={`flex items-center gap-1.5 pr-2 shrink-0 transition-opacity duration-[280ms] ease-[cubic-bezier(0.25,0.1,0.25,1)] ${
            hovered ? "opacity-100" : "opacity-0"
          }`}
        >
          {isRecording ? (
            <>
              {/* Recording dot + timer */}
              <span className="flex items-center gap-1 shrink-0">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500 animate-pulse" />
                <span className="font-mono text-[10px] font-semibold text-text-primary tabular-nums whitespace-nowrap">
                  {formatTime(elapsedSeconds)}
                </span>
              </span>

              {/* Pause/Resume */}
              <button
                onMouseDown={(e) => e.stopPropagation()}
                onClick={status === "paused" ? onResumeRecording : onPauseRecording}
                className="flex h-[27px] w-[27px] shrink-0 items-center justify-center rounded-[9px] text-text-secondary transition-colors hover:bg-white/10 hover:text-text-primary"
                title={status === "paused" ? "Resume" : "Pause"}
              >
                {status === "paused" ? (
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="5 3 19 12 5 21" />
                  </svg>
                ) : (
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="6" y="4" width="4" height="16" rx="1" />
                    <rect x="14" y="4" width="4" height="16" rx="1" />
                  </svg>
                )}
              </button>

              {/* Stop */}
              <button
                onMouseDown={(e) => e.stopPropagation()}
                onClick={onStopRecording}
                className="flex h-[27px] w-[27px] shrink-0 items-center justify-center rounded-[9px] bg-red-500/18 text-red-300 transition-colors hover:bg-red-500/28"
                title="Stop"
              >
                <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="4" y="4" width="16" height="16" rx="2" />
                </svg>
              </button>
            </>
          ) : (
            <>
              {/* Mic icon with hidden select overlay */}
              <div className="relative shrink-0" onMouseDown={(e) => e.stopPropagation()}>
                <div className="flex h-[31px] w-[31px] items-center justify-center rounded-[9px] text-[#89a2c7] transition-colors hover:bg-white/10 hover:text-[#a7bfde]">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
                className="flex h-[27px] w-[27px] shrink-0 items-center justify-center rounded-[9px] bg-red-500 transition-colors hover:bg-red-600"
                title="Record"
              >
                <span className="h-2 w-2 rounded-full bg-white/90" />
              </button>
            </>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
