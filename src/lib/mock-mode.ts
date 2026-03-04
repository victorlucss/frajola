function isTruthyFlag(value: string | null): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

/**
 * Allow forcing mock/demo mode through URL query for screenshot sessions.
 * Supported params: ?mock=1, ?demo=1, ?screenshot=1
 */
export function isForcedMockModeFromUrl(): boolean {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  return (
    isTruthyFlag(params.get("mock")) ||
    isTruthyFlag(params.get("demo")) ||
    isTruthyFlag(params.get("screenshot"))
  );
}
