import type { IconName } from "../shared/Icon";

export type Category = "general" | "ai" | "transcription" | "dictation";

export interface SettingsSectionProps {
  getSetting: (key: string) => string | undefined;
  updateSetting: (key: string, value: string) => Promise<void>;
}

export const CATEGORIES: { key: Category; label: string; icon: IconName }[] = [
  { key: "general", label: "General", icon: "settings" },
  { key: "ai", label: "AI Provider", icon: "globe" },
  { key: "transcription", label: "Transcription", icon: "mic" },
  { key: "dictation", label: "Dictation", icon: "message-square" },
];
