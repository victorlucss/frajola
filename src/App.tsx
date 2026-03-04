import { useState, useMemo, useCallback, useEffect } from "react";
import type { MeetingDetail as MeetingDetailType } from "./types";
import { getMockDetail } from "./lib/mock-data";
import { isForcedMockModeFromUrl } from "./lib/mock-mode";
import { isTauri, invoke } from "./lib/tauri";
import { useMeetings } from "./hooks/useMeetings";
import { useMeetingDetail } from "./hooks/useMeetingDetail";
import { useRecording } from "./hooks/useRecording";
import { useTheme } from "./hooks/useTheme";

import AppShell from "./components/layout/AppShell";
import IconRail from "./components/layout/IconRail";
import Sidebar from "./components/layout/Sidebar";
import MainPanel from "./components/layout/MainPanel";
import MeetingDetail from "./components/meetings/MeetingDetail";
import MeetingEmpty from "./components/meetings/MeetingEmpty";
import RecordingIndicator from "./components/recording/RecordingIndicator";
import SettingsPage from "./components/settings/SettingsPage";
import OnboardingFlow from "./components/onboarding/OnboardingFlow";

function App() {
  useTheme();
  const [forceMockMode, setForceMockMode] = useState(() => isForcedMockModeFromUrl());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedMeetingId, setSelectedMeetingId] = useState<number | null>(null);
  const [onboardingReady, setOnboardingReady] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const { meetings, refresh } = useMeetings({ forceMock: forceMockMode });

  const recording = useRecording({
    onComplete: async (meeting) => {
      await refresh();
      setSelectedMeetingId(meeting.id);
      setSettingsOpen(false);
      // Trigger transcription in the background
      if (isTauri()) {
        invoke("transcribe_meeting", { meetingId: meeting.id }).catch((err) => {
          console.error("Transcription failed:", err);
        });
      }
    },
  });

  const { detail: realDetail, refresh: refreshDetail } = useMeetingDetail(selectedMeetingId, {
    forceMock: forceMockMode,
  });

  const meetingDetail: MeetingDetailType | null = useMemo(() => {
    if (!selectedMeetingId) return null;
    // Use real data from backend if available
    if (realDetail) return realDetail;
    // Fallback to mock data for demo meetings
    const mock = getMockDetail(selectedMeetingId);
    if (!mock) return null;
    // Convert mock format to MeetingDetail
    return {
      meeting: mock.meeting,
      transcript: mock.transcript.map((t, i) => ({
        id: i,
        meeting_id: mock.meeting.id,
        speaker: t.speaker,
        start_ms: parseTimestamp(t.timestamp),
        end_ms: 0,
        content: t.text,
      })),
      summary: mock.summary,
      action_items: mock.action_items.map((a, i) => ({
        id: i,
        meeting_id: mock.meeting.id,
        description: a.text,
        assignee: a.assignee ?? null,
        completed: a.done,
      })),
      notes: mock.notes,
    };
  }, [selectedMeetingId, realDetail]);

  function handleNewRecording() {
    if (recording.status === "idle") {
      recording.startRecording();
    } else if (recording.status === "recording" || recording.status === "paused") {
      recording.stopRecording();
    }
  }

  const isRecordingActive = recording.status !== "idle";

  const toggleSettings = useCallback(() => setSettingsOpen((o) => !o), []);

  useEffect(() => {
    const urlForcedMock = isForcedMockModeFromUrl();

    if (!isTauri()) {
      setForceMockMode(urlForcedMock);
      setOnboardingReady(true);
      setShowOnboarding(false);
      return;
    }

    Promise.all([
      invoke<string | null>("get_setting", { key: "onboarding_completed" }).catch(() => null),
      invoke<string | null>("get_setting", { key: "mock_mode" }).catch(() => null),
    ])
      .then(([onboardingCompleted, mockMode]) => {
        const enabledMockMode = urlForcedMock || mockMode === "1";
        setForceMockMode(enabledMockMode);
        setShowOnboarding(enabledMockMode ? false : onboardingCompleted !== "1");
      })
      .catch(() => {
        setForceMockMode(urlForcedMock);
        setShowOnboarding(!urlForcedMock);
      })
      .finally(() => {
        setOnboardingReady(true);
      });
  }, []);

  useEffect(() => {
    const onMockModeChanged = (event: Event) => {
      const detail = (event as CustomEvent<boolean>).detail;
      setForceMockMode(Boolean(detail));
      if (detail) {
        setShowOnboarding(false);
      }
    };

    window.addEventListener("mock-mode-changed", onMockModeChanged);
    return () => window.removeEventListener("mock-mode-changed", onMockModeChanged);
  }, []);

  useEffect(() => {
    if (!forceMockMode) return;
    if (meetings.length === 0) return;

    const hasSelected = selectedMeetingId !== null && meetings.some((m) => m.id === selectedMeetingId);
    if (!hasSelected) {
      setSelectedMeetingId(meetings[0].id);
    }
  }, [forceMockMode, meetings, selectedMeetingId]);

  useEffect(() => {
    if (forceMockMode) return;
    if (selectedMeetingId === null) return;
    if (meetings.length === 0) return;

    const hasSelected = meetings.some((m) => m.id === selectedMeetingId);
    if (!hasSelected) {
      setSelectedMeetingId(meetings[0].id);
    }
  }, [forceMockMode, meetings, selectedMeetingId]);

  if (!onboardingReady) {
    return (
      <div className="h-screen w-screen bg-bg flex items-center justify-center text-sm text-text-tertiary">
        Loading...
      </div>
    );
  }

  return (
    <>
      <AppShell
        iconRail={
          <IconRail
            onSettingsToggle={toggleSettings}
            settingsOpen={settingsOpen}
            onNewRecording={handleNewRecording}
            isRecording={isRecordingActive}
          />
        }
        sidebar={
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
        }
        main={
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
        }
      />
      {settingsOpen && <SettingsPage onClose={() => setSettingsOpen(false)} />}
      {showOnboarding && !forceMockMode && (
        <OnboardingFlow
          onComplete={() => {
            setShowOnboarding(false);
          }}
        />
      )}
    </>
  );
}

/** Parse "HH:MM:SS" or "MM:SS" timestamp to milliseconds */
function parseTimestamp(ts: string): number {
  const parts = ts.split(":").map(Number);
  if (parts.length === 3) {
    return (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
  }
  return (parts[0] * 60 + parts[1]) * 1000;
}

export default App;
