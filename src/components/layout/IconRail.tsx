import frajolaLogo from "../../../assets/frajola.png";
import Icon from "../shared/Icon";
import type { IconName } from "../shared/Icon";

interface Props {
  onNewRecording: () => void;
  onSettingsToggle: () => void;
  settingsOpen: boolean;
  isRecording?: boolean;
}

const navItems: { icon: IconName; label: string }[] = [
  { icon: "home", label: "Home" },
];


export default function IconRail({ onNewRecording, onSettingsToggle, settingsOpen, isRecording }: Props) {
  return (
    <div className="flex h-full w-12 flex-col items-center border-r border-border bg-surface py-2">
      {/* Logo */}
      <div className="mb-3 flex h-8 w-8 items-center justify-center">
        <img
          src={frajolaLogo}
          alt="Frajola"
          className="h-6 w-6 rounded"
        />
      </div>

      {/* Top nav */}
      <div className="flex flex-col items-center gap-1">
        {navItems.map((item) => (
          <button
            key={item.label}
            title={item.label}
            className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors bg-accent-glow text-accent"
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
          title={isRecording ? "Stop recording" : "New recording"}
          className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
            isRecording
              ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
              : "text-text-tertiary hover:bg-accent-glow hover:text-accent"
          }`}
        >
          {isRecording ? (
            <span className="relative flex h-4 w-4 items-center justify-center">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-40" />
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                <rect x="4" y="4" width="16" height="16" rx="2" />
              </svg>
            </span>
          ) : (
            <span className="h-3.5 w-3.5 rounded-full bg-red-500" />
          )}
        </button>
        <button
          onClick={onSettingsToggle}
          title="Settings"
          className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
            settingsOpen
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
