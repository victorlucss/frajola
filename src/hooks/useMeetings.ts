import { useEffect, useState } from "react";
import type { Meeting } from "../types";
import { isTauri, invoke } from "../lib/tauri";
import { mockMeetings } from "../lib/mock-data";

interface UseMeetingsResult {
  meetings: Meeting[];
  isDemo: boolean;
  loading: boolean;
}

export function useMeetings(): UseMeetingsResult {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [isDemo, setIsDemo] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
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
    }
    load();
  }, []);

  return { meetings, isDemo, loading };
}
