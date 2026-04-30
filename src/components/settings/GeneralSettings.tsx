import { useEffect, useState } from "react";
import { emit } from "@tauri-apps/api/event";
import { invoke, isTauri } from "../../lib/tauri";
import { SelectField, ToggleField } from "./fields";
import type { SettingsSectionProps } from "./types";

interface AudioDevice {
  id: string;
  name: string;
  is_default: boolean;
  device_type: "input" | "output";
}

const SYSTEM_DEFAULT = "";

export default function GeneralSettings({ getSetting, updateSetting }: SettingsSectionProps) {
  const [inputs, setInputs] = useState<AudioDevice[]>([]);

  useEffect(() => {
    if (!isTauri()) return;
    invoke<AudioDevice[]>("list_audio_devices")
      .then((devs) => setInputs(devs.filter((d) => d.device_type === "input")))
      .catch(() => setInputs([]));
  }, []);

  const selectedMic = getSetting("mic_device_id") ?? SYSTEM_DEFAULT;
  const defaultMic = inputs.find((d) => d.is_default);

  const micOptions = [
    {
      value: SYSTEM_DEFAULT,
      label: defaultMic ? `System default (${defaultMic.name})` : "System default",
    },
    ...inputs.map((d) => ({ value: d.id, label: d.name })),
  ];

  const meetingPillEnabled = (getSetting("show_meeting_pill") ?? "1") === "1";

  return (
    <div className="space-y-4">
      <SelectField
        label="Theme"
        value={getSetting("theme") ?? "system"}
        options={[
          { value: "system", label: "System" },
          { value: "light", label: "Light" },
          { value: "dark", label: "Dark" },
        ]}
        onChange={(v) => {
          void updateSetting("theme", v);
          window.dispatchEvent(new CustomEvent("theme-changed", { detail: v }));
        }}
      />

      <SelectField
        label="Microphone"
        value={selectedMic}
        options={micOptions}
        onChange={(v) => void updateSetting("mic_device_id", v)}
      />

      <ToggleField
        label="Show Frajola pill for meetings"
        description="When off, the floating pill only appears during dictation."
        checked={meetingPillEnabled}
        onChange={(next) => {
          const value = next ? "1" : "0";
          void updateSetting("show_meeting_pill", value);
          // Notify all webviews (overlay lives in its own window).
          void emit("meeting-pill-visibility-changed", next);
        }}
      />
    </div>
  );
}
