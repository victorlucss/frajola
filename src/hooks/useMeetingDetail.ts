import { useEffect, useState, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import type { MeetingDetail } from "../types";
import { isTauri, invoke } from "../lib/tauri";

interface UseMeetingDetailResult {
  detail: MeetingDetail | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useMeetingDetail(meetingId: number | null): UseMeetingDetailResult {
  const [detail, setDetail] = useState<MeetingDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!meetingId || !isTauri()) {
      setDetail(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await invoke<MeetingDetail>("get_meeting_detail", { id: meetingId });
      setDetail(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [meetingId]);

  useEffect(() => {
    load();
  }, [load]);

  // Listen for transcription/summarization events to auto-refresh
  useEffect(() => {
    if (!meetingId || !isTauri()) return;

    const events = ["transcription-complete", "summarization-started", "summarization-complete"];
    const unlisteners = events.map((event) =>
      listen<{ meeting_id: number }>(event, (e) => {
        if (e.payload.meeting_id === meetingId) {
          load();
        }
      })
    );

    return () => {
      unlisteners.forEach((p) => p.then((fn) => fn()));
    };
  }, [meetingId, load]);

  return { detail, loading, error, refresh: load };
}
