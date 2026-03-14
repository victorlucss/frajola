import { useState, useCallback, useEffect } from "react";
import { isTauri, invoke } from "./lib/tauri";
import { useMeetings } from "./hooks/useMeetings";
import { useMeetingDetail } from "./hooks/useMeetingDetail";
import { useRecording } from "./hooks/useRecording";
import { useTheme } from "./hooks/useTheme";

import type { View } from "./types";
import type { Category } from "./components/settings/types";
import AppShell from "./components/layout/AppShell";
import IconRail from "./components/layout/IconRail";
import Sidebar from "./components/layout/Sidebar";
import MainPanel from "./components/layout/MainPanel";
import MeetingDetail from "./components/meetings/MeetingDetail";
import MeetingEmpty from "./components/meetings/MeetingEmpty";
import RecordingIndicator from "./components/recording/RecordingIndicator";
import SettingsContent from "./components/settings/SettingsContent";
import OnboardingFlow from "./components/onboarding/OnboardingFlow";

function App() {
  useTheme();
  const [view, setView] = useState<View>("home");
  const [settingsCategory, setSettingsCategory] = useState<Category>("general");
  const [selectedMeetingId, setSelectedMeetingId] = useState<number | null>(null);
  const [onboardingReady, setOnboardingReady] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const { meetings, refresh } = useMeetings();

  const recording = useRecording({
    onComplete: async (meeting) => {
      await refresh();
      setSelectedMeetingId(meeting.id);
      setView("home");
      // Trigger transcription in the background
      if (isTauri()) {
        invoke("transcribe_meeting", { meetingId: meeting.id }).catch((err) => {
          console.error("Transcription failed:", err);
        });
      }
    },
  });

  const { detail: meetingDetail, refresh: refreshDetail } = useMeetingDetail(selectedMeetingId);

  function handleNewRecording() {
    if (recording.status === "idle") {
      setView("home");
      recording.startRecording();
    } else if (recording.status === "recording" || recording.status === "paused") {
      recording.stopRecording();
    }
  }

  const isRecordingActive = recording.status !== "idle";

  const toggleSettings = useCallback(() => setView((v) => (v === "settings" ? "home" : "settings")), []);

  // Escape key to leave settings
  useEffect(() => {
    if (view !== "settings") return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      const tag = (document.activeElement?.tagName ?? "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      setView("home");
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [view]);

  useEffect(() => {
    if (!isTauri()) {
      setOnboardingReady(true);
      setShowOnboarding(false);
      return;
    }

    invoke<string | null>("get_setting", { key: "onboarding_completed" })
      .then((onboardingCompleted) => {
        setShowOnboarding(onboardingCompleted !== "1");
      })
      .catch(() => {
        setShowOnboarding(true);
      })
      .finally(() => {
        setOnboardingReady(true);
      });
  }, []);

  useEffect(() => {
    if (selectedMeetingId === null) return;
    if (meetings.length === 0) return;

    const hasSelected = meetings.some((m) => m.id === selectedMeetingId);
    if (!hasSelected) {
      setSelectedMeetingId(meetings[0].id);
    }
  }, [meetings, selectedMeetingId]);

  if (!onboardingReady) {
    return (
      <div className="h-screen w-screen bg-bg flex items-center justify-center text-sm text-text-tertiary">
        Loading...
      </div>
    );
  }

  const settingsOpen = view === "settings";

  return (
    <>
      <AppShell
        iconRail={
          settingsOpen ? undefined : (
            <IconRail
              onSettingsToggle={toggleSettings}
              settingsOpen={settingsOpen}
              onNewRecording={handleNewRecording}
              isRecording={isRecordingActive}
            />
          )
        }
        sidebar={
          settingsOpen ? undefined : (
            <Sidebar
              meetings={meetings}
              selectedId={selectedMeetingId}
              onSelect={setSelectedMeetingId}
              recordingIndicator={
                isRecordingActive ? (
                  <RecordingIndicator
                    status={recording.status}
                    elapsedSeconds={recording.elapsedSeconds}
                    onPause={recording.pauseRecording}
                    onResume={recording.resumeRecording}
                    onStop={recording.stopRecording}
                  />
                ) : undefined
              }
            />
          )
        }
        main={
          settingsOpen ? (
            <SettingsContent
              category={settingsCategory}
              onCategoryChange={setSettingsCategory}
              onBack={() => setView("home")}
            />
          ) : (
            <MainPanel>
              {meetingDetail ? (
                <MeetingDetail detail={meetingDetail} onRefresh={refreshDetail} />
              ) : (
                <MeetingEmpty />
              )}
              {recording.error && (
                <div className="fixed bottom-4 right-4 max-w-sm rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                  <p>{recording.error}</p>
                  <button
                    onClick={() => invoke("open_audio_permission_settings")}
                    className="mt-2 rounded bg-red-500/20 px-3 py-1 text-xs font-medium text-red-200 hover:bg-red-500/30 transition-colors"
                  >
                    Open System Settings
                  </button>
                </div>
              )}
            </MainPanel>
          )
        }
      />
      {showOnboarding && (
        <OnboardingFlow
          onComplete={() => {
            setShowOnboarding(false);
          }}
        />
      )}
    </>
  );
}

export default App;
