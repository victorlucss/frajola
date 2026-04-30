import { useEffect, useState } from "react";
import { invoke, isTauri } from "../../lib/tauri";

interface Props {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes <= 0) return "—";
  const mb = bytes / (1024 * 1024);
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

const POLL_INTERVAL_MS = 4000;

export default function TitleBarChrome({ sidebarOpen, onToggleSidebar }: Props) {
  const [memory, setMemory] = useState<number | null>(null);

  useEffect(() => {
    if (!isTauri()) return;
    let alive = true;

    const tick = async () => {
      try {
        const bytes = await invoke<number>("get_process_memory");
        if (alive) setMemory(bytes);
      } catch {
        // Best-effort; pill simply hides on probe failure.
      }
    };

    tick();
    const id = setInterval(tick, POLL_INTERVAL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed top-0 right-0 z-[60] flex h-[52px] items-center gap-2 px-3">
      {/* Sidebar toggle — sits where macOS sidebar buttons usually do but we
          render in the right gutter so the traffic-light area stays clear. */}
      <button
        type="button"
        title={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
        aria-label={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
        onClick={onToggleSidebar}
        className="pointer-events-auto flex h-7 w-7 items-center justify-center rounded-md text-text-tertiary hover:bg-bg-card hover:text-text-secondary transition-colors"
      >
        <SidebarIcon open={sidebarOpen} />
      </button>

      {/* Memory pill */}
      {memory !== null && memory > 0 && (
        <div
          className="pointer-events-auto flex items-center gap-1.5 rounded-md border border-border bg-bg-card/70 px-2 py-1 text-[11px] font-medium text-text-secondary"
          title="Resident memory"
        >
          <ChipIcon />
          <span>{formatBytes(memory)}</span>
        </div>
      )}
    </div>
  );
}

function SidebarIcon({ open }: { open: boolean }) {
  // Two-rectangle "sidebar" glyph: outer rounded rect + inner divider.
  // When open, fill the left column to indicate "currently shown."
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <line x1="9" y1="4" x2="9" y2="20" />
      {open && <rect x="3" y="4" width="6" height="16" rx="2" fill="currentColor" opacity="0.25" stroke="none" />}
    </svg>
  );
}

function ChipIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <rect x="6" y="6" width="12" height="12" rx="1.5" />
      <rect x="9" y="9" width="6" height="6" rx="0.5" />
      <line x1="3" y1="10" x2="6" y2="10" />
      <line x1="3" y1="14" x2="6" y2="14" />
      <line x1="18" y1="10" x2="21" y2="10" />
      <line x1="18" y1="14" x2="21" y2="14" />
      <line x1="10" y1="3" x2="10" y2="6" />
      <line x1="14" y1="3" x2="14" y2="6" />
      <line x1="10" y1="18" x2="10" y2="21" />
      <line x1="14" y1="18" x2="14" y2="21" />
    </svg>
  );
}
