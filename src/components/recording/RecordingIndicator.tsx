import { formatElapsed } from "../../lib/date";
import type { RecordingStatus } from "../../hooks/useRecording";
import Icon from "../shared/Icon";

interface Props {
  status: RecordingStatus;
  elapsedSeconds: number;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
}

export default function RecordingIndicator({
  status,
  elapsedSeconds,
  onPause,
  onResume,
  onStop,
}: Props) {
  if (status === "idle") return null;

  const isRecording = status === "recording";
  const isPaused = status === "paused";
  const isStopping = status === "stopping";

  return (
    <div className="flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2">
      {/* Pulsing dot */}
      <span className="relative flex h-2.5 w-2.5">
        {isRecording && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
        )}
        <span
          className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
            isPaused ? "bg-yellow-400" : "bg-red-400"
          }`}
        />
      </span>

      {/* Timer */}
      <span className="font-mono text-xs font-medium text-red-300">
        {formatElapsed(elapsedSeconds)}
      </span>

      {/* Pause / Resume */}
      {!isStopping && (
        <button
          onClick={isPaused ? onResume : onPause}
          className="flex h-5 w-5 items-center justify-center rounded text-red-300 hover:bg-red-500/20"
          title={isPaused ? "Resume" : "Pause"}
        >
          {isPaused ? (
            <Icon name="mic" size={12} />
          ) : (
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          )}
        </button>
      )}

      {/* Stop */}
      {!isStopping && (
        <button
          onClick={onStop}
          className="flex h-5 w-5 items-center justify-center rounded text-red-300 hover:bg-red-500/20"
          title="Stop recording"
        >
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <rect x="4" y="4" width="16" height="16" rx="2" />
          </svg>
        </button>
      )}

      {isStopping && (
        <span className="text-xs text-red-300/60">Stopping...</span>
      )}
    </div>
  );
}
