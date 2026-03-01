import type { Meeting } from "../../types";
import { formatDuration } from "../../lib/date";

interface Props {
  meeting: Meeting;
  selected: boolean;
  onClick: () => void;
}

export default function MeetingListItem({ meeting, selected, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className={`group flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
        selected ? "bg-bg-card" : "hover:bg-bg-card-hover"
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className={`truncate text-sm font-medium ${
              selected ? "text-text-primary" : "text-text-secondary"
            }`}
          >
            {meeting.title}
          </span>
          {meeting.is_demo && (
            <span className="shrink-0 rounded bg-accent-glow px-1.5 py-0.5 text-[10px] font-medium text-accent">
              Demo
            </span>
          )}
        </div>
        {meeting.subtitle && (
          <p className="truncate text-xs text-text-tertiary">
            {meeting.subtitle}
          </p>
        )}
        <p className="mt-0.5 text-xs text-text-muted">
          {formatDuration(meeting.duration_seconds)}
        </p>
      </div>
    </button>
  );
}
