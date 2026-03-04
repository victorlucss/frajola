export interface Meeting {
  id: number;
  title: string | null;
  subtitle?: string;
  created_at: string;
  updated_at?: string;
  duration_seconds: number | null;
  audio_path?: string | null;
  language: string | null;
  status: "recording" | "transcribing" | "summarizing" | "complete" | "failed";
  is_demo?: boolean;
}

export interface TranscriptSegment {
  id: number;
  meeting_id: number;
  speaker: string | null;
  start_ms: number;
  end_ms: number;
  content: string;
}

export interface ActionItem {
  id: number;
  meeting_id: number;
  description: string;
  assignee: string | null;
  completed: boolean;
}

export interface Summary {
  overview: string;
  key_points: string[];
  decisions: string[];
}

export interface MeetingDetail {
  meeting: Meeting;
  transcript: TranscriptSegment[];
  summary: Summary | null;
  action_items: ActionItem[];
  notes?: string;
}

/** Mock action item used in demo data */
export interface MockActionItem {
  id: string;
  text: string;
  assignee?: string;
  done: boolean;
}

/** Mock detail uses legacy format for demo data */
export interface MockMeetingDetail {
  meeting: Meeting;
  summary: Summary;
  transcript: { id: string; timestamp: string; speaker: string; text: string }[];
  action_items: MockActionItem[];
  notes: string;
}

export interface Setting {
  key: string;
  value: string;
}

export type Tab = "summary" | "actions" | "transcript";

export type View = "home";
