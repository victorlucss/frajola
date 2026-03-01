import { useEffect, useState, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import type { Meeting } from "../types";
import { isTauri, invoke } from "../lib/tauri";
import { mockMeetings } from "../lib/mock-data";

interface UseMeetingsResult {
  meetings: Meeting[];
  isDemo: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
}

export function useMeetings(): UseMeetingsResult {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [isDemo, setIsDemo] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (isTauri()) {
      try {
        const result = await invoke<Meeting[]>("list_meetings");
        if (result.length > 0) {
          setMeetings(result);
          setIsDemo(false);
        } else {
          setMeetings(mockMeetings);
          setIsDemo(true);
        }
      } catch {
        setMeetings(mockMeetings);
        setIsDemo(true);
      }
    } else {
      setMeetings(mockMeetings);
      setIsDemo(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Auto-refresh when transcription/summarization completes
  useEffect(() => {
    if (!isTauri()) return;
    const events = ["transcription-complete", "summarization-complete"];
    const unlisteners = events.map((event) =>
      listen(event, () => {
        load();
      })
    );
    return () => {
      unlisteners.forEach((p) => p.then((fn) => fn()));
    };
  }, [load]);

  return { meetings, isDemo, loading, refresh: load };
}
