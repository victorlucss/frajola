import type { Tab, MeetingDetail } from "../../types";
import Icon from "../shared/Icon";
import type { IconName } from "../shared/Icon";

interface Props {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  detail: MeetingDetail;
}

const tabs: { id: Tab; label: string; icon: IconName }[] = [
  { id: "summary", label: "Summary", icon: "file-text" },
  { id: "actions", label: "Action Items", icon: "check-circle" },
  { id: "transcript", label: "Transcript", icon: "mic" },
  { id: "notes", label: "Notes", icon: "message-square" },
];

export default function MeetingTabs({ activeTab, onTabChange, detail }: Props) {
  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Tab bar */}
      <div className="flex gap-1 border-b border-border px-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-sm transition-colors ${
              activeTab === tab.id
                ? "border-b-2 border-accent text-text-primary -mb-px"
                : "text-text-tertiary hover:text-text-secondary"
            }`}
          >
            <Icon name={tab.icon} size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === "summary" && <SummaryContent detail={detail} />}
        {activeTab === "actions" && <ActionsContent detail={detail} />}
        {activeTab === "transcript" && <TranscriptContent detail={detail} />}
        {activeTab === "notes" && <NotesContent detail={detail} />}
      </div>
    </div>
  );
}

function SummaryContent({ detail }: { detail: MeetingDetail }) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-text-tertiary">
          Overview
        </h3>
        <p className="text-sm leading-relaxed text-text-secondary">
          {detail.summary.overview}
        </p>
      </div>
      <div>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-text-tertiary">
          Key Points
        </h3>
        <ul className="space-y-1.5">
          {detail.summary.key_points.map((point, i) => (
            <li key={i} className="flex gap-2 text-sm text-text-secondary">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
              {point}
            </li>
          ))}
        </ul>
      </div>
      {detail.summary.decisions.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-text-tertiary">
            Decisions
          </h3>
          <ul className="space-y-1.5">
            {detail.summary.decisions.map((decision, i) => (
              <li key={i} className="flex gap-2 text-sm text-text-secondary">
                <span className="mt-0.5 text-accent">
                  <Icon name="chevron-right" size={14} />
                </span>
                {decision}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ActionsContent({ detail }: { detail: MeetingDetail }) {
  return (
    <div className="space-y-2">
      {detail.action_items.map((item) => (
        <div
          key={item.id}
          className="flex items-start gap-3 rounded-lg bg-bg-card p-3"
        >
          <div
            className={`mt-0.5 h-4 w-4 shrink-0 rounded border ${
              item.done
                ? "border-accent bg-accent"
                : "border-text-tertiary"
            }`}
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm text-text-secondary">{item.text}</p>
            {item.assignee && (
              <p className="mt-1 text-xs text-text-tertiary">
                Assigned to {item.assignee}
              </p>
            )}
          </div>
        </div>
      ))}
      {detail.action_items.length === 0 && (
        <p className="text-sm text-text-tertiary">No action items</p>
      )}
    </div>
  );
}

function TranscriptContent({ detail }: { detail: MeetingDetail }) {
  return (
    <div className="space-y-3">
      {detail.transcript.map((seg) => (
        <div key={seg.id} className="flex gap-3">
          <span className="mt-0.5 w-16 shrink-0 text-right font-mono text-xs text-text-muted">
            {seg.timestamp}
          </span>
          <div className="min-w-0 flex-1">
            <span className="text-xs font-medium text-accent">
              {seg.speaker}
            </span>
            <p className="text-sm leading-relaxed text-text-secondary">
              {seg.text}
            </p>
          </div>
        </div>
      ))}
      {detail.transcript.length === 0 && (
        <p className="text-sm text-text-tertiary">No transcript available</p>
      )}
    </div>
  );
}

function NotesContent({ detail }: { detail: MeetingDetail }) {
  return (
    <div>
      {detail.notes ? (
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-text-secondary">
          {detail.notes}
        </p>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Icon name="message-square" size={24} className="mb-2 text-text-muted" />
          <p className="text-sm text-text-tertiary">No notes yet</p>
          <p className="mt-1 text-xs text-text-muted">
            Notes editing coming soon
          </p>
        </div>
      )}
    </div>
  );
}
