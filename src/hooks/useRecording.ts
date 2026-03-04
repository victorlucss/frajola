import { useState, useRef, useCallback, useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { isTauri, invoke } from "../lib/tauri";
import type { Meeting } from "../types";

export type RecordingStatus = "idle" | "recording" | "paused" | "stopping";

interface UseRecordingOptions {
  onComplete?: (meeting: Meeting) => void;
}

interface StartRecordingResult {
  meeting: Meeting;
}

interface RecordingStatusResult {
  meeting_id: number;
  elapsed_seconds: number;
  is_paused: boolean;
}

export interface UseRecordingReturn {
  status: RecordingStatus;
  meetingId: number | null;
  elapsedSeconds: number;
  error: string | null;
  startRecording: (micDeviceId?: string) => Promise<void>;
  stopRecording: () => Promise<void>;
  pauseRecording: () => Promise<void>;
  resumeRecording: () => Promise<void>;
}

export function useRecording(options?: UseRecordingOptions): UseRecordingReturn {
  const [status, setStatus] = useState<RecordingStatus>("idle");
  const [meetingId, setMeetingId] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Track whether this window initiated the action, to avoid double-processing events
  const localActionRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    clearTimer();
    timerRef.current = setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);
  }, [clearTimer]);

  const startRecording = useCallback(async (micDeviceId?: string) => {
    if (!isTauri()) {
      setError("Recording is only available in the desktop app");
      return;
    }

    setError(null);
    localActionRef.current = true;
    try {
      const result = await invoke<StartRecordingResult>("start_recording", {
        micDeviceId: micDeviceId ?? null,
        captureSystemAudio: true,
      });
      setMeetingId(result.meeting.id);
      setStatus("recording");
      setElapsedSeconds(0);
      startTimer();
    } catch (err) {
      setError(String(err));
    } finally {
      localActionRef.current = false;
    }
  }, [startTimer]);

  const stopRecording = useCallback(async () => {
    clearTimer();
    setStatus("stopping");
    localActionRef.current = true;
    try {
      const meeting = await invoke<Meeting>("stop_recording");
      setStatus("idle");
      setMeetingId(null);
      setElapsedSeconds(0);
      options?.onComplete?.(meeting);
    } catch (err) {
      setError(String(err));
      setStatus("idle");
    } finally {
      localActionRef.current = false;
    }
  }, [clearTimer, options, startTimer]);

  const pauseRecording = useCallback(async () => {
    clearTimer();
    localActionRef.current = true;
    try {
      await invoke<void>("pause_recording");
      setStatus("paused");
    } catch (err) {
      setError(String(err));
    } finally {
      localActionRef.current = false;
    }
  }, [clearTimer]);

  const resumeRecording = useCallback(async () => {
    localActionRef.current = true;
    try {
      await invoke<void>("resume_recording");
      setStatus("recording");
      startTimer();
    } catch (err) {
      setError(String(err));
    } finally {
      localActionRef.current = false;
    }
  }, [startTimer]);

  const syncStatusFromBackend = useCallback(async () => {
    if (!isTauri() || localActionRef.current) return;
    try {
      const result = await invoke<RecordingStatusResult | null>("get_recording_status");
      if (!result) {
        clearTimer();
        setStatus("idle");
        setMeetingId(null);
        setElapsedSeconds(0);
        return;
      }

      setMeetingId(result.meeting_id);
      setElapsedSeconds(result.elapsed_seconds);
      if (result.is_paused) {
        clearTimer();
        setStatus("paused");
      } else {
        setStatus("recording");
        startTimer();
      }
    } catch {
      // Best effort sync only.
    }
  }, [clearTimer, startTimer]);

  // Cross-window event sync
  useEffect(() => {
    if (!isTauri()) return;

    const unlisteners = [
      listen<{ meeting_id: number }>("recording-started", (event) => {
        if (localActionRef.current) return;
        setMeetingId(event.payload.meeting_id);
        setStatus("recording");
        setElapsedSeconds(0);
        startTimer();
      }),
      listen<{ meeting_id: number }>("recording-stopped", () => {
        if (localActionRef.current) return;
        clearTimer();
        setStatus("idle");
        setMeetingId(null);
        setElapsedSeconds(0);
      }),
      listen<void>("recording-paused", () => {
        if (localActionRef.current) return;
        clearTimer();
        setStatus("paused");
      }),
      listen<void>("recording-resumed", () => {
        if (localActionRef.current) return;
        setStatus("recording");
        startTimer();
      }),
    ];

    return () => {
      unlisteners.forEach((p) => p.then((f) => f()));
    };
  }, [clearTimer, startTimer]);

  // Initial state hydration — pick up any in-progress recording
  useEffect(() => {
    void syncStatusFromBackend();
  }, [syncStatusFromBackend]);

  // Recover if cross-window events are missed while this window is hidden/minimized.
  useEffect(() => {
    if (!isTauri()) return;

    const onFocus = () => {
      void syncStatusFromBackend();
    };
    const onVisibilityChange = () => {
      if (!document.hidden) {
        void syncStatusFromBackend();
      }
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [syncStatusFromBackend]);

  useEffect(() => {
    return () => clearTimer();
  }, [clearTimer]);

  return {
    status,
    meetingId,
    elapsedSeconds,
    error,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
  };
}
