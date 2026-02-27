import { useEffect, useState } from "react";
import type { Setting } from "../types";
import { isTauri, invoke } from "../lib/tauri";

interface UseSettingsResult {
  settings: Setting[];
  loading: boolean;
  error: string | null;
}

export function useSettings(): UseSettingsResult {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!isTauri()) {
        setError("Settings require the Tauri desktop app.");
        setLoading(false);
        return;
      }
      try {
        const result = await invoke<Setting[]>("get_settings");
        setSettings(result);
      } catch (err) {
        setError(String(err));
      }
      setLoading(false);
    }
    load();
  }, []);

  return { settings, loading, error };
}
