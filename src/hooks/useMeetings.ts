import { useEffect, useState, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import type { Meeting } from "../types";
import { isTauri, invoke } from "../lib/tauri";

interface UseMeetingsResult {
  meetings: Meeting[];
  loading: boolean;
  refresh: () => Promise<void>;
}

export function useMeetings(): UseMeetingsResult {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (isTauri()) {
      try {
        const result = await invoke<Meeting[]>("list_meetings");
        setMeetings(result);
      } catch {
        setMeetings([]);
      }
    } else {
      setMeetings([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Auto-refresh when backend processing or recording lifecycle events happen.
  useEffect(() => {
    if (!isTauri()) return;
    const events = [
      "recording-started",
      "recording-stopped",
      "transcription-complete",
      "summarization-complete",
    ];
    const unlisteners = events.map((event) =>
      listen(event, () => {
        load();
      })
    );
    return () => {
      unlisteners.forEach((p) => p.then((fn) => fn()));
    };
  }, [load]);

  return { meetings, loading, refresh: load };
}
