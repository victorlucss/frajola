import { useState, useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "../lib/tauri";
import { useRecording } from "../hooks/useRecording";
import OverlayPill from "./components/OverlayPill";
import OverlayExpanded from "./components/OverlayExpanded";
import type { DetectedMeeting } from "./types";

interface MeetingDetectionEvent {
  meetings: DetectedMeeting[];
}

export default function OverlayApp() {
  const [expanded, setExpanded] = useState(false);
  const [meetings, setMeetings] = useState<DetectedMeeting[]>([]);
  const recording = useRecording({
    onComplete: async (meeting) => {
      invoke("transcribe_meeting", { meetingId: meeting.id }).catch((err) => {
        console.error("Transcription failed:", err);
      });
    },
  });

  useEffect(() => {
    const unlistenDetection = listen<MeetingDetectionEvent>("meeting-detection-changed", (event) => {
      setMeetings(event.payload.meetings);
    });

    return () => {
      unlistenDetection.then((f) => f());
    };
  }, []);

  const handleExpand = () => {
    setExpanded(true);
    invoke("expand_overlay").catch(() => {});
  };

  const handleCollapse = () => {
    setExpanded(false);
    invoke("collapse_overlay").catch(() => {});
  };

  return (
    <div className="h-screen w-screen bg-transparent">
      {expanded ? (
        <OverlayExpanded
          status={recording.status}
          elapsedSeconds={recording.elapsedSeconds}
          meetings={meetings}
          error={recording.error}
          silenceWarning={recording.silenceWarning}
          onCollapse={handleCollapse}
          onStartRecording={recording.startRecording}
          onStopRecording={recording.stopRecording}
          onPauseRecording={recording.pauseRecording}
          onResumeRecording={recording.resumeRecording}
        />
      ) : (
        <OverlayPill
          status={recording.status}
          elapsedSeconds={recording.elapsedSeconds}
          meetings={meetings}
          silenceWarning={recording.silenceWarning}
          onExpand={handleExpand}
          onStartRecording={recording.startRecording}
          onStopRecording={recording.stopRecording}
          onPauseRecording={recording.pauseRecording}
          onResumeRecording={recording.resumeRecording}
        />
      )}
    </div>
  );
}
