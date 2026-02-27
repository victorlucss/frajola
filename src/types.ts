export interface Meeting {
  id: string;
  title: string;
  subtitle?: string;
  created_at: string;
  duration_seconds: number;
  language: string;
  status: "completed" | "recording" | "transcribing" | "processing";
  is_demo?: boolean;
}

export interface TranscriptSegment {
  id: string;
  timestamp: string;
  speaker: string;
  text: string;
}

export interface ActionItem {
  id: string;
  text: string;
  assignee?: string;
  done: boolean;
}

export interface Summary {
  overview: string;
  key_points: string[];
  decisions: string[];
}

export interface MeetingDetail {
  meeting: Meeting;
  summary: Summary;
  transcript: TranscriptSegment[];
  action_items: ActionItem[];
  notes: string;
}

export interface Setting {
  key: string;
  value: string;
}

export type Tab = "summary" | "actions" | "transcript" | "notes";

export type View = "home" | "settings";
