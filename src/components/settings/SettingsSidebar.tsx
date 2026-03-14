import Icon from "../shared/Icon";
import { CATEGORIES } from "./types";
import type { Category } from "./types";

const isMac = navigator.userAgent.includes("Mac");

interface Props {
  category: Category;
  onCategoryChange: (cat: Category) => void;
  onBack: () => void;
}

export default function SettingsSidebar({ category, onCategoryChange, onBack }: Props) {
  return (
    <div className="flex h-full w-[260px] shrink-0 flex-col border-r border-border bg-bg">
      {/* Back link */}
      <div className={`shrink-0 px-3 pb-2 ${isMac ? "pt-8" : "pt-4"}`}>
        <button
          onClick={onBack}
          className="relative z-[51] flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors"
        >
          <Icon name="arrow-left" size={14} />
          <span>Back to app</span>
        </button>
      </div>

      {/* Category nav */}
      <nav className="flex-1 px-2">
        <div className="space-y-0.5">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              onClick={() => onCategoryChange(cat.key)}
              className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                category === cat.key
                  ? "bg-accent-glow text-accent"
                  : "text-text-secondary hover:text-text-primary hover:bg-bg-card"
              }`}
            >
              <Icon name={cat.icon} size={16} />
              <span>{cat.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
