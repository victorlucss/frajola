import { useState } from "react";
import type { MeetingDetail as MeetingDetailType, Tab } from "../../types";
import { formatDate, formatTime, formatDuration } from "../../lib/date";
import { isTauri, invoke } from "../../lib/tauri";
import Icon from "../shared/Icon";
import type { IconName } from "../shared/Icon";
import MeetingTabs from "./MeetingTabs";
import AudioPlayer from "./AudioPlayer";

interface Props {
  detail: MeetingDetailType;
  onRefresh?: () => Promise<void>;
}

const metaItems: {
  label: string;
  icon: IconName;
  getValue: (d: MeetingDetailType) => string;
}[] = [
  {
    label: "Created",
    icon: "calendar",
    getValue: (d) =>
      `${formatDate(d.meeting.created_at)} at ${formatTime(d.meeting.created_at)}`,
  },
  {
    label: "Duration",
    icon: "clock",
    getValue: (d) => formatDuration(d.meeting.duration_seconds),
  },
  {
    label: "Status",
    icon: "check-circle",
    getValue: (d) => d.meeting.status.charAt(0).toUpperCase() + d.meeting.status.slice(1),
  },
];

export default function MeetingDetail({ detail, onRefresh }: Props) {
  const isTranscribing = detail.meeting.status === "transcribing";
  const isSummarizing = detail.meeting.status === "summarizing";
  const isProcessing = isTranscribing || isSummarizing;
  const defaultTab: Tab = detail.meeting.is_demo ? "summary" : "transcript";
  const [activeTab, setActiveTab] = useState<Tab>(defaultTab);
  const [showRetranscribeModal, setShowRetranscribeModal] = useState(false);

  const canRetranscribe =
    isTauri() &&
    !detail.meeting.is_demo &&
    !isProcessing &&
    detail.meeting.audio_path &&
    detail.meeting.status !== "recording";

  const handleRetranscribe = async () => {
    setShowRetranscribeModal(false);
    // Fire transcription (don't await — it runs in background)
    invoke("transcribe_meeting", { meetingId: detail.meeting.id }).catch(
      (err) => console.error("Re-transcription failed:", err)
    );
    // Small delay to let the backend clear data + set status, then refresh
    await new Promise((r) => setTimeout(r, 200));
    onRefresh?.();
  };

  return (
    <div className="flex h-full flex-col">
      {/* Re-transcribe confirmation modal */}
      {showRetranscribeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-border bg-bg-elevated p-6 shadow-2xl">
            <h3 className="text-base font-semibold text-text-primary">
              Re-transcribe meeting?
            </h3>
            <p className="mt-2 text-sm text-text-secondary">
              This will delete the current transcript, summary, and action items,
              then re-process the audio from scratch.
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={() => setShowRetranscribeModal(false)}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-bg-card"
              >
                Cancel
              </button>
              <button
                onClick={handleRetranscribe}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-bg transition-colors hover:bg-accent-dim"
              >
                Re-transcribe
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Processing indicator */}
      {isTranscribing && (
        <div className="flex items-center gap-2 border-b border-accent/20 bg-accent/5 px-6 py-3">
          <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
          <span className="text-sm font-medium text-accent">
            Transcribing audio...
          </span>
        </div>
      )}
      {isSummarizing && (
        <div className="flex items-center gap-2 border-b border-accent/20 bg-accent/5 px-6 py-3">
          <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
          <span className="text-sm font-medium text-accent">
            Summarizing with AI...
          </span>
        </div>
      )}

      {/* Header */}
      <div className="shrink-0 border-b border-border px-6 py-5">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold text-text-primary">
            {detail.meeting.title}
          </h1>
          {detail.meeting.is_demo && (
            <span className="rounded bg-accent-glow px-2 py-0.5 text-xs font-medium text-accent">
              Demo
            </span>
          )}
          {canRetranscribe && (
            <button
              onClick={() => setShowRetranscribeModal(true)}
              title="Re-transcribe"
              className="ml-auto flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-bg-card hover:text-text-primary"
            >
              <Icon name="refresh" size={13} />
              Re-transcribe
            </button>
          )}
        </div>
        {detail.meeting.subtitle && (
          <p className="mt-0.5 text-sm text-text-tertiary">
            {detail.meeting.subtitle}
          </p>
        )}

        {/* Metadata */}
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
          {metaItems.map((item) => (
            <div key={item.label} className="flex items-center gap-1.5">
              <Icon name={item.icon} size={14} className="text-text-muted" />
              <span className="text-xs text-text-tertiary">{item.label}:</span>
              <span className="text-xs text-text-secondary">
                {item.getValue(detail)}
              </span>
            </div>
          ))}
        </div>

        {/* Audio player */}
        {detail.meeting.audio_path &&
          !detail.meeting.is_demo &&
          detail.meeting.status !== "recording" && (
            <AudioPlayer audioPath={detail.meeting.audio_path} durationSeconds={detail.meeting.duration_seconds} />
          )}
      </div>

      {/* Tabs + content */}
      <MeetingTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        detail={detail}
      />

    </div>
  );
}
