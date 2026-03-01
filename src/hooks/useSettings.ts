import { useCallback, useEffect, useState } from "react";
import type { Setting } from "../types";
import { isTauri, invoke } from "../lib/tauri";

interface UseSettingsResult {
  settings: Setting[];
  loading: boolean;
  error: string | null;
  getSetting: (key: string) => string | undefined;
  updateSetting: (key: string, value: string) => Promise<void>;
}

export function useSettings(): UseSettingsResult {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const getSetting = useCallback(
    (key: string): string | undefined => {
      return settings.find((s) => s.key === key)?.value;
    },
    [settings],
  );

  const updateSetting = useCallback(
    async (key: string, value: string) => {
      if (!isTauri()) return;
      await invoke("set_setting", { key, value });
      await load();
    },
    [load],
  );

  return { settings, loading, error, getSetting, updateSetting };
}
