import { useEffect, useState, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import type { Meeting } from "../types";
import { isTauri, invoke } from "../lib/tauri";
import { mockMeetings } from "../lib/mock-data";

interface UseMeetingsResult {
  meetings: Meeting[];
  loading: boolean;
  refresh: () => Promise<void>;
}

interface UseMeetingsOptions {
  forceMock?: boolean;
}

export function useMeetings(options: UseMeetingsOptions = {}): UseMeetingsResult {
  const forceMock = options.forceMock ?? false;
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (forceMock) {
      setMeetings(mockMeetings);
      setLoading(false);
      return;
    }

    if (isTauri()) {
      try {
        const result = await invoke<Meeting[]>("list_meetings");
        if (result.length > 0) {
          setMeetings(result);
        } else {
          setMeetings(mockMeetings);
        }
      } catch {
        setMeetings(mockMeetings);
      }
    } else {
      setMeetings(mockMeetings);
    }
    setLoading(false);
  }, [forceMock]);

  useEffect(() => {
    load();
  }, [load]);

  // Auto-refresh when backend processing or recording lifecycle events happen.
  useEffect(() => {
    if (!isTauri() || forceMock) return;
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
  }, [forceMock, load]);

  return { meetings, loading, refresh: load };
}
