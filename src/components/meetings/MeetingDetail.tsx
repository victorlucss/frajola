import { useState } from "react";
import type { MeetingDetail as MeetingDetailType, Tab } from "../../types";
import { formatDate, formatTime, formatDuration } from "../../lib/date";
import Icon from "../shared/Icon";
import type { IconName } from "../shared/Icon";
import MeetingTabs from "./MeetingTabs";
import AskBar from "../shared/AskBar";

interface Props {
  detail: MeetingDetailType;
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
    label: "Language",
    icon: "globe",
    getValue: (d) => d.meeting.language ?? "en",
  },
  {
    label: "Status",
    icon: "check-circle",
    getValue: (d) => d.meeting.status.charAt(0).toUpperCase() + d.meeting.status.slice(1),
  },
];

export default function MeetingDetail({ detail }: Props) {
  const isTranscribing = detail.meeting.status === "transcribing";
  const isSummarizing = detail.meeting.status === "summarizing";
  const defaultTab: Tab = detail.meeting.is_demo ? "summary" : "transcript";
  const [activeTab, setActiveTab] = useState<Tab>(defaultTab);

  return (
    <div className="flex h-full flex-col">
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
      </div>

      {/* Tabs + content */}
      <MeetingTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        detail={detail}
      />

      {/* Ask bar */}
      <div className="shrink-0 border-t border-border p-4">
        <AskBar />
      </div>
    </div>
  );
}
