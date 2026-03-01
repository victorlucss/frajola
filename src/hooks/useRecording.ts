import { useState, useRef, useCallback, useEffect } from "react";
import { isTauri, invoke } from "../lib/tauri";
import type { Meeting } from "../types";

export type RecordingStatus = "idle" | "recording" | "paused" | "stopping";

interface UseRecordingOptions {
  onComplete?: (meeting: Meeting) => void;
}

interface StartRecordingResult {
  meeting: Meeting;
}

interface UseRecordingReturn {
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

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startRecording = useCallback(async (micDeviceId?: string) => {
    if (!isTauri()) {
      setError("Recording is only available in the desktop app");
      return;
    }

    setError(null);
    try {
      const result = await invoke<StartRecordingResult>("start_recording", {
        micDeviceId: micDeviceId ?? null,
        captureSystemAudio: true,
      });
      setMeetingId(result.meeting.id);
      setStatus("recording");
      setElapsedSeconds(0);
      timerRef.current = setInterval(() => {
        setElapsedSeconds((s) => s + 1);
      }, 1000);
    } catch (err) {
      setError(String(err));
    }
  }, []);

  const stopRecording = useCallback(async () => {
    clearTimer();
    setStatus("stopping");
    try {
      const meeting = await invoke<Meeting>("stop_recording");
      setStatus("idle");
      setMeetingId(null);
      setElapsedSeconds(0);
      options?.onComplete?.(meeting);
    } catch (err) {
      setError(String(err));
      setStatus("idle");
    }
  }, [clearTimer, options]);

  const pauseRecording = useCallback(async () => {
    clearTimer();
    try {
      await invoke<void>("pause_recording");
      setStatus("paused");
    } catch (err) {
      setError(String(err));
    }
  }, [clearTimer]);

  const resumeRecording = useCallback(async () => {
    try {
      await invoke<void>("resume_recording");
      setStatus("recording");
      timerRef.current = setInterval(() => {
        setElapsedSeconds((s) => s + 1);
      }, 1000);
    } catch (err) {
      setError(String(err));
    }
  }, []);

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
