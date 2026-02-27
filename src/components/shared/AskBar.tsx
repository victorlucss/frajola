import { useState } from "react";
import Icon from "./Icon";

export default function AskBar() {
  const [showToast, setShowToast] = useState(false);

  function handleInteraction() {
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2000);
  }

  return (
    <div className="relative">
      <div
        className="flex items-center gap-2 rounded-lg border border-border bg-bg-elevated px-3 py-2.5 cursor-pointer transition-colors hover:border-border-subtle"
        onClick={handleInteraction}
      >
        <Icon name="message-square" size={16} className="text-text-tertiary shrink-0" />
        <span className="text-sm text-text-tertiary">
          Ask Frajola anything...
        </span>
      </div>
      {showToast && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 rounded-md bg-bg-card px-3 py-1.5 text-xs text-text-secondary shadow-lg whitespace-nowrap">
          Coming soon
        </div>
      )}
    </div>
  );
}
