import { useSettings } from "../../hooks/useSettings";
import type { Category } from "./types";
import { CATEGORIES } from "./types";
import SettingsSidebar from "./SettingsSidebar";
import GeneralSettings from "./GeneralSettings";
import AiSettings from "./AiSettings";
import TranscriptionSettings from "./TranscriptionSettings";
import DictationSettings from "./DictationSettings";

const isMac = navigator.userAgent.includes("Mac");

interface Props {
  category: Category;
  onCategoryChange: (cat: Category) => void;
  onBack: () => void;
}

export default function SettingsContent({ category, onCategoryChange, onBack }: Props) {
  const { loading, error, getSetting, updateSetting } = useSettings();

  const categoryLabel = CATEGORIES.find((c) => c.key === category)?.label ?? category;

  return (
    <div className="flex h-full overflow-hidden">
      {/* Settings sidebar */}
      <SettingsSidebar category={category} onCategoryChange={onCategoryChange} onBack={onBack} />

      {/* Settings content */}
      <div className="flex flex-1 flex-col overflow-hidden bg-bg-elevated">
        {/* Header */}
        <div className={`shrink-0 px-8 pb-4 ${isMac ? "pt-8" : "pt-4"}`}>
          <h1 className="text-xl font-semibold text-text-primary">{categoryLabel}</h1>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-8 pb-16">
          <div className="max-w-xl">
            {loading ? (
              <p className="text-sm text-text-tertiary">Loading settings...</p>
            ) : error ? (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
                {error}
              </div>
            ) : (
              <>
                {category === "general" && (
                  <GeneralSettings getSetting={getSetting} updateSetting={updateSetting} />
                )}
                {category === "ai" && (
                  <AiSettings getSetting={getSetting} updateSetting={updateSetting} />
                )}
                {category === "transcription" && (
                  <TranscriptionSettings getSetting={getSetting} updateSetting={updateSetting} />
                )}
                {category === "dictation" && <DictationSettings />}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
