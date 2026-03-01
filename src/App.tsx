import { useState, useMemo, useCallback } from "react";
import type { MeetingDetail as MeetingDetailType } from "./types";
import { getMockDetail } from "./lib/mock-data";
import { isTauri, invoke } from "./lib/tauri";
import { useMeetings } from "./hooks/useMeetings";
import { useMeetingDetail } from "./hooks/useMeetingDetail";
import { useRecording } from "./hooks/useRecording";

import AppShell from "./components/layout/AppShell";
import IconRail from "./components/layout/IconRail";
import Sidebar from "./components/layout/Sidebar";
import MainPanel from "./components/layout/MainPanel";
import MeetingDetail from "./components/meetings/MeetingDetail";
import MeetingEmpty from "./components/meetings/MeetingEmpty";
import RecordingIndicator from "./components/recording/RecordingIndicator";
import SettingsPage from "./components/settings/SettingsPage";

function App() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedMeetingId, setSelectedMeetingId] = useState<number | null>(null);

  const { meetings, isDemo, refresh } = useMeetings();

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

  const { detail: realDetail } = useMeetingDetail(selectedMeetingId);

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
            isDemo={isDemo}
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
              <MeetingDetail detail={meetingDetail} />
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
