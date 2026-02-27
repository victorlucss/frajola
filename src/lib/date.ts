export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export type DateGroup = {
  label: string;
  meetings: { id: string; [key: string]: unknown }[];
};

export function groupByDate<T extends { id: string; created_at: string }>(
  meetings: T[],
): { label: string; meetings: T[] }[] {
  const now = new Date();
  const today = startOfDay(now);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const groups: Record<string, T[]> = {};
  const order: string[] = [];

  for (const m of meetings) {
    const d = new Date(m.created_at);
    let label: string;

    if (d >= today) {
      label = "Today";
    } else if (d >= yesterday) {
      label = "Yesterday";
    } else if (d >= weekAgo) {
      label = "Previous 7 days";
    } else {
      label = d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    }

    if (!groups[label]) {
      groups[label] = [];
      order.push(label);
    }
    groups[label].push(m);
  }

  return order.map((label) => ({ label, meetings: groups[label] }));
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}
