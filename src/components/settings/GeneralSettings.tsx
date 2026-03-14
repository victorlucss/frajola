import { SelectField } from "./fields";
import type { SettingsSectionProps } from "./types";

export default function GeneralSettings({ getSetting, updateSetting }: SettingsSectionProps) {
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
    </div>
  );
}
