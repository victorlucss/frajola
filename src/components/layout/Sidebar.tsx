import type { Meeting } from "../../types";
import { groupByDate } from "../../lib/date";
import MeetingListItem from "../meetings/MeetingListItem";

interface Props {
  meetings: Meeting[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  isDemo: boolean;
  recordingIndicator?: React.ReactNode;
}

export default function Sidebar({ meetings, selectedId, onSelect, isDemo, recordingIndicator }: Props) {
  const groups = groupByDate(meetings);

  return (
    <div className="flex h-full flex-col border-r border-border bg-bg/72">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between px-4 py-4">
        <h2 className="text-sm font-semibold text-text-primary">Meetings</h2>
        {isDemo && (
          <span className="rounded bg-accent-glow px-2 py-0.5 text-[10px] font-medium text-accent">
            Demo data
          </span>
        )}
      </div>

      {/* Recording indicator */}
      {recordingIndicator && (
        <div className="shrink-0 px-3 pb-3">{recordingIndicator}</div>
      )}

      {/* Meeting list */}
      <div className="flex-1 overflow-y-auto px-2 pb-4">
        {groups.map((group) => (
          <div key={group.label} className="mb-4">
            <p className="mb-1 px-3 text-[11px] font-medium uppercase tracking-wider text-text-muted">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.meetings.map((m) => (
                <MeetingListItem
                  key={m.id}
                  meeting={m}
                  selected={m.id === selectedId}
                  onClick={() => onSelect(m.id)}
                />
              ))}
            </div>
          </div>
        ))}
        {meetings.length === 0 && (
          <p className="px-3 text-sm text-text-tertiary">No meetings yet</p>
        )}
      </div>
    </div>
  );
}
