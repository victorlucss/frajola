interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
}

export type IconName =
  | "home"
  | "calendar"
  | "search"
  | "plus"
  | "settings"
  | "mic"
  | "clock"
  | "globe"
  | "check-circle"
  | "file-text"
  | "message-square"
  | "chevron-right"
  | "cat";

const paths: Record<IconName, string> = {
  home: "M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z M9 21V12h6v9",
  calendar:
    "M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z M16 2v4 M8 2v4 M3 10h18",
  search: "M11 17.25a6.25 6.25 0 1 1 0-12.5 6.25 6.25 0 0 1 0 12.5z M16 16l4.5 4.5",
  plus: "M12 5v14 M5 12h14",
  settings:
    "M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  mic: "M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z M19 10v2a7 7 0 0 1-14 0v-2 M12 19v3",
  clock: "M12 21.5a9.5 9.5 0 1 0 0-19 9.5 9.5 0 0 0 0 19z M12 6v6l4 2",
  globe:
    "M12 21.5a9.5 9.5 0 1 0 0-19 9.5 9.5 0 0 0 0 19z M2.5 12h19 M12 2.5a14.5 14.5 0 0 1 4 9.5 14.5 14.5 0 0 1-4 9.5 14.5 14.5 0 0 1-4-9.5A14.5 14.5 0 0 1 12 2.5",
  "check-circle":
    "M12 21.5a9.5 9.5 0 1 0 0-19 9.5 9.5 0 0 0 0 19z M9 12l2 2 4-4",
  "file-text":
    "M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8",
  "message-square":
    "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10z",
  "chevron-right": "M9 18l6-6-6-6",
  cat: "M12 5C8 1 2 1 2 5c0 3 2 5 4 7-1 2-2 4-2 6 0 3 3 4 5 4 1 0 2-.5 3-1.5C13 21.5 14 22 15 22c2 0 5-1 5-4 0-2-1-4-2-6 2-2 4-4 4-7 0-4-6-4-10 0z M8 9v.01 M16 9v.01",
};

export default function Icon({ name, size = 18, className = "" }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {paths[name].split(" M").map((d, i) => (
        <path key={i} d={i === 0 ? d : `M${d}`} />
      ))}
    </svg>
  );
}
