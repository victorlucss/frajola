import { useState, useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "../lib/tauri";
import { useRecording } from "../hooks/useRecording";
import OverlayPill from "./components/OverlayPill";
import OverlayExpanded from "./components/OverlayExpanded";
import DictationPill from "./components/DictationPill";
import type { DetectedMeeting } from "./types";

interface MeetingDetectionEvent {
  meetings: DetectedMeeting[];
}

export default function OverlayApp() {
  const [expanded, setExpanded] = useState(false);
  const [meetings, setMeetings] = useState<DetectedMeeting[]>([]);
  const [dictating, setDictating] = useState(false);
  const [processing, setProcessing] = useState(false);
  // Keep DictationPill mounted briefly after dictation stops for exit animation
  const [showWave, setShowWave] = useState(false);

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
    return () => { unlistenDetection.then((f) => f()); };
  }, []);

  // Dictation lifecycle
  useEffect(() => {
    const unsubs = [
      listen("dictation-started", () => {
        setShowWave(true);
        setProcessing(false);
        requestAnimationFrame(() => setDictating(true));
        invoke("show_dictation_overlay").catch(() => {});
      }),
      listen("dictation-processing", () => {
        setProcessing(true);
      }),
      listen("dictation-completed", () => {
        setDictating(false);
        setProcessing(false);
        setTimeout(() => {
          setShowWave(false);
          invoke("hide_dictation_overlay").catch(() => {});
        }, 300);
      }),
      listen("dictation-error", () => {
        setDictating(false);
        setProcessing(false);
        setTimeout(() => {
          setShowWave(false);
          invoke("hide_dictation_overlay").catch(() => {});
        }, 300);
      }),
    ];
    return () => { unsubs.forEach((p) => p.then((f) => f())); };
  }, []);

  const handleExpand = () => {
    setExpanded(true);
    invoke("expand_overlay").catch(() => {});
  };

  const handleCollapse = () => {
    setExpanded(false);
    invoke("collapse_overlay").catch(() => {});
  };

  // Expanded mode — no morphing needed
  if (expanded) {
    return (
      <div className="h-screen w-screen bg-transparent">
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
      </div>
    );
  }

  // Default: pill with crossfade between frajola icon and wave dots
  return (
    <div className="h-screen w-screen bg-transparent" style={{ position: "relative" }}>
      {/* Frajola pill — fades out when dictating */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: dictating ? 0 : 1,
          transition: "opacity 250ms ease-in-out",
          pointerEvents: dictating ? "none" : "auto",
        }}
      >
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
      </div>

      {/* Dictation wave — fades in when dictating */}
      {showWave && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: dictating ? 1 : 0,
            transition: "opacity 250ms ease-in-out",
            pointerEvents: dictating ? "auto" : "none",
          }}
        >
          <DictationPill processing={processing} />
        </div>
      )}
    </div>
  );
}
