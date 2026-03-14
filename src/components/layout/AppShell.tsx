import type { ReactNode } from "react";

const isMac = navigator.userAgent.includes("Mac");

interface Props {
  iconRail?: ReactNode;
  sidebar?: ReactNode;
  main: ReactNode;
}

export default function AppShell({ iconRail, sidebar, main }: Props) {
  const cols = iconRail && sidebar
    ? "grid-cols-[48px_260px_1fr]"
    : iconRail
      ? "grid-cols-[48px_1fr]"
      : "grid-cols-[1fr]";

  return (
    <div className={`grid h-screen ${cols} grid-rows-[minmax(0,1fr)] overflow-hidden`}>
      {/* Drag region spanning the full title bar area (macOS only) */}
      {isMac && (
        <div
          data-tauri-drag-region
          className="fixed inset-x-0 top-0 z-50 h-[52px]"
        />
      )}
      {iconRail}
      {sidebar}
      {main}
    </div>
  );
}
