import Icon from "../shared/Icon";
import type { IconName } from "../shared/Icon";
import type { View } from "../../types";

interface Props {
  activeView: View;
  onViewChange: (view: View) => void;
  onNewRecording: () => void;
}

const topItems: { view: View; icon: IconName; label: string }[] = [
  { view: "home", icon: "home", label: "Home" },
];

const placeholderItems: { icon: IconName; label: string }[] = [
  { icon: "calendar", label: "Calendar" },
  { icon: "search", label: "Search" },
];

export default function IconRail({ activeView, onViewChange, onNewRecording }: Props) {
  return (
    <div className="flex h-full w-12 flex-col items-center border-r border-border bg-surface py-3">
      {/* Logo */}
      <div className="mb-4 flex h-8 w-8 items-center justify-center">
        <img
          src="/assets/frajola.png"
          alt="Frajola"
          className="h-6 w-6 rounded"
        />
      </div>

      {/* Top nav */}
      <div className="flex flex-col items-center gap-1">
        {topItems.map((item) => (
          <button
            key={item.view}
            onClick={() => onViewChange(item.view)}
            title={item.label}
            className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
              activeView === item.view
                ? "bg-accent-glow text-accent"
                : "text-text-tertiary hover:text-text-secondary hover:bg-bg-card"
            }`}
          >
            <Icon name={item.icon} size={18} />
          </button>
        ))}
        {placeholderItems.map((item) => (
          <button
            key={item.label}
            title={`${item.label} (coming soon)`}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted cursor-not-allowed"
          >
            <Icon name={item.icon} size={18} />
          </button>
        ))}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Bottom actions */}
      <div className="flex flex-col items-center gap-1">
        <button
          onClick={onNewRecording}
          title="New recording"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-text-tertiary transition-colors hover:bg-accent-glow hover:text-accent"
        >
          <Icon name="plus" size={18} />
        </button>
        <button
          onClick={() => onViewChange("settings")}
          title="Settings"
          className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
            activeView === "settings"
              ? "bg-accent-glow text-accent"
              : "text-text-tertiary hover:text-text-secondary hover:bg-bg-card"
          }`}
        >
          <Icon name="settings" size={18} />
        </button>
      </div>
    </div>
  );
}
