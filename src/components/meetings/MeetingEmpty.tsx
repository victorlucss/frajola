import Icon from "../shared/Icon";

export default function MeetingEmpty() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-bg-card">
        <Icon name="cat" size={32} className="text-text-tertiary" />
      </div>
      <div>
        <p className="text-sm font-medium text-text-secondary">
          Select a meeting
        </p>
        <p className="mt-1 text-xs text-text-tertiary">
          Choose a meeting from the sidebar to view details
        </p>
      </div>
    </div>
  );
}
