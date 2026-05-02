import { useCallback, useEffect, useState } from "react";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { isTauri } from "../lib/tauri";

export type UpdaterPhase =
  | "idle"
  | "checking"
  | "available"
  | "downloading"
  | "installing"
  | "ready"
  | "uptodate"
  | "error";

export interface UpdaterState {
  phase: UpdaterPhase;
  version?: string;
  notes?: string;
  progress?: number; // 0-1 during downloading
  error?: string;
}

interface UseUpdaterReturn extends UpdaterState {
  checkNow: () => Promise<void>;
  installAndRelaunch: () => Promise<void>;
}

/**
 * Wrapper around tauri-plugin-updater. Performs an automatic check on mount
 * (silent — only surfaces if an update is available) and exposes manual
 * controls for a "Check for updates" button.
 *
 * Requires the updater plugin to be registered in lib.rs and `plugins.updater`
 * configured in tauri.conf.json. Outside of Tauri the hook stays in `idle`.
 */
export function useUpdater(): UseUpdaterReturn {
  const [state, setState] = useState<UpdaterState>({ phase: "idle" });
  const [pendingUpdate, setPendingUpdate] = useState<Update | null>(null);

  const checkNow = useCallback(async () => {
    if (!isTauri()) return;
    setState({ phase: "checking" });
    try {
      const update = await check();
      if (update) {
        setPendingUpdate(update);
        setState({
          phase: "available",
          version: update.version,
          notes: update.body ?? undefined,
        });
      } else {
        setState({ phase: "uptodate" });
      }
    } catch (e) {
      setState({ phase: "error", error: String(e) });
    }
  }, []);

  const installAndRelaunch = useCallback(async () => {
    if (!pendingUpdate) return;
    setState((s) => ({ ...s, phase: "downloading", progress: 0 }));
    try {
      let downloaded = 0;
      let total: number | undefined;
      await pendingUpdate.downloadAndInstall((event) => {
        if (event.event === "Started") {
          total = event.data.contentLength ?? undefined;
        } else if (event.event === "Progress") {
          downloaded += event.data.chunkLength;
          setState((s) => ({
            ...s,
            phase: "downloading",
            progress: total ? downloaded / total : undefined,
          }));
        } else if (event.event === "Finished") {
          setState((s) => ({ ...s, phase: "installing" }));
        }
      });
      setState((s) => ({ ...s, phase: "ready" }));
      await relaunch();
    } catch (e) {
      setState({ phase: "error", error: String(e) });
    }
  }, [pendingUpdate]);

  // Silent check on mount.
  useEffect(() => {
    if (!isTauri()) return;
    void checkNow();
  }, [checkNow]);

  return { ...state, checkNow, installAndRelaunch };
}
