import { useEffect } from "react";
import { isTauri, invoke } from "../lib/tauri";

function applyDesktopBackgroundMode(resolvedTheme: string) {
  const isOverlay = new URLSearchParams(window.location.search).has("overlay");
  if (!isTauri() || isOverlay) return;

  // Vibrancy effects only work on macOS; skip on Windows/Linux
  const isMac = navigator.userAgent.includes("Mac");
  if (!isMac) return;

  const root = document.getElementById("root");
  const enableVibrancy = resolvedTheme === "dark";

  if (enableVibrancy) {
    document.documentElement.classList.add("vibrancy-mode");
    document.body.classList.add("vibrancy-mode");
    document.documentElement.style.background = "transparent";
    document.body.style.background = "transparent";
    if (root) root.style.background = "transparent";
    return;
  }

  document.documentElement.classList.remove("vibrancy-mode");
  document.body.classList.remove("vibrancy-mode");
  document.documentElement.style.background = "";
  document.body.style.background = "";
  if (root) root.style.background = "";
}

function applyTheme(theme: string) {
  let resolved = theme;
  if (theme === "system" || !theme) {
    resolved = window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  document.documentElement.dataset.theme = resolved;
  applyDesktopBackgroundMode(resolved);
}

export function useTheme() {
  useEffect(() => {
    // Fetch initial theme from settings
    if (isTauri()) {
      invoke<string | null>("get_setting", { key: "theme" })
        .then((v) => applyTheme(v ?? "system"))
        .catch(() => applyTheme("system"));
    }

    // Listen for user changes from SettingsPage
    function onThemeChanged(e: Event) {
      applyTheme((e as CustomEvent<string>).detail);
    }
    window.addEventListener("theme-changed", onThemeChanged);

    // Listen for OS color-scheme changes (for "system" mode)
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    function onSystemChange() {
      // Only react if current setting is "system"
      const current = document.documentElement.dataset.theme;
      // If user explicitly chose light/dark, ignore OS changes
      // Re-read from settings to check
      if (isTauri()) {
        invoke<string | null>("get_setting", { key: "theme" })
          .then((v) => {
            if (!v || v === "system") applyTheme("system");
          })
          .catch(() => {});
      } else {
        // Non-tauri: always follow system
        if (!current || current === "dark" || current === "light") {
          applyTheme("system");
        }
      }
    }
    mq.addEventListener("change", onSystemChange);

    return () => {
      window.removeEventListener("theme-changed", onThemeChanged);
      mq.removeEventListener("change", onSystemChange);
    };
  }, []);
}
