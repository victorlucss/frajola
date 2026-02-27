import { useState, useMemo } from "react";
import type { View } from "./types";
import { getMockDetail } from "./lib/mock-data";
import { useMeetings } from "./hooks/useMeetings";
import { useSettings } from "./hooks/useSettings";

import AppShell from "./components/layout/AppShell";
import IconRail from "./components/layout/IconRail";
import Sidebar from "./components/layout/Sidebar";
import MainPanel from "./components/layout/MainPanel";
import MeetingDetail from "./components/meetings/MeetingDetail";
import MeetingEmpty from "./components/meetings/MeetingEmpty";
import Icon from "./components/shared/Icon";

function App() {
  const [view, setView] = useState<View>("home");
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);

  const { meetings, isDemo } = useMeetings();
  const { settings, error: settingsError } = useSettings();

  const meetingDetail = useMemo(() => {
    if (!selectedMeetingId) return null;
    return getMockDetail(selectedMeetingId) ?? null;
  }, [selectedMeetingId]);

  function handleNewRecording() {
    // Placeholder — will trigger recording in the future
  }

  return (
    <AppShell
      iconRail={
        <IconRail
          activeView={view}
          onViewChange={(v) => {
            setView(v);
            if (v !== "home") setSelectedMeetingId(null);
          }}
          onNewRecording={handleNewRecording}
        />
      }
      sidebar={
        view === "home" ? (
          <Sidebar
            meetings={meetings}
            selectedId={selectedMeetingId}
            onSelect={setSelectedMeetingId}
            isDemo={isDemo}
          />
        ) : (
          <SettingsSidebar />
        )
      }
      main={
        <MainPanel>
          {view === "home" ? (
            meetingDetail ? (
              <MeetingDetail detail={meetingDetail} />
            ) : (
              <MeetingEmpty />
            )
          ) : (
            <SettingsPanel settings={settings} error={settingsError} />
          )}
        </MainPanel>
      }
    />
  );
}

function SettingsSidebar() {
  return (
    <div className="flex h-full flex-col border-r border-border bg-bg">
      <div className="px-4 py-4">
        <h2 className="text-sm font-semibold text-text-primary">Settings</h2>
      </div>
      <div className="flex-1 overflow-y-auto px-2">
        <div className="space-y-0.5">
          {["General", "Privacy", "AI Provider", "Transcription", "Language"].map(
            (section) => (
              <div
                key={section}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-text-secondary hover:bg-bg-card-hover transition-colors cursor-pointer"
              >
                <Icon name="settings" size={14} className="text-text-muted" />
                {section}
              </div>
            ),
          )}
        </div>
      </div>
    </div>
  );
}

interface SettingsPanelProps {
  settings: { key: string; value: string }[];
  error: string | null;
}

function SettingsPanel({ settings, error }: SettingsPanelProps) {
  return (
    <div className="flex h-full flex-col overflow-y-auto p-6">
      <h1 className="mb-1 text-lg font-semibold text-text-primary">Settings</h1>
      <p className="mb-6 text-sm text-text-tertiary">
        Loaded from SQLite
      </p>

      {error ? (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
          {error}
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-bg-card">
          {settings.map((s, i) => (
            <div
              key={s.key}
              className={`flex items-center justify-between px-4 py-3 ${
                i < settings.length - 1 ? "border-b border-border-subtle" : ""
              }`}
            >
              <span className="font-mono text-sm text-text-secondary">
                {s.key}
              </span>
              <span className="rounded-full bg-accent-glow px-3 py-1 text-sm font-medium text-accent">
                {s.value}
              </span>
            </div>
          ))}
          {settings.length === 0 && (
            <p className="px-4 py-4 text-center text-sm text-text-tertiary">
              Loading...
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
