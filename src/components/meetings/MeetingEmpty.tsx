import outlineLogo from "../../../assets/outline.png";

export default function MeetingEmpty() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
      <img src={outlineLogo} alt="" className="h-16 w-16 opacity-15" />
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
