import type { Meeting, MeetingDetail } from "../types";

const now = new Date();
const today = (h: number, m: number) => {
  const d = new Date(now);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
};
const daysAgo = (days: number, h: number, m: number) => {
  const d = new Date(now);
  d.setDate(d.getDate() - days);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
};

export const mockMeetings: Meeting[] = [
  {
    id: "demo-1",
    title: "Sprint Planning",
    subtitle: "Engineering Team",
    created_at: today(10, 0),
    duration_seconds: 2700,
    language: "en",
    status: "completed",
    is_demo: true,
  },
  {
    id: "demo-2",
    title: "1:1 with Sarah",
    subtitle: "Manager Sync",
    created_at: today(14, 30),
    duration_seconds: 1800,
    language: "en",
    status: "completed",
    is_demo: true,
  },
  {
    id: "demo-3",
    title: "Product Review",
    subtitle: "Design + Product",
    created_at: daysAgo(1, 11, 0),
    duration_seconds: 3600,
    language: "en",
    status: "completed",
    is_demo: true,
  },
  {
    id: "demo-4",
    title: "Client Onboarding Call",
    subtitle: "Acme Corp",
    created_at: daysAgo(1, 16, 0),
    duration_seconds: 2400,
    language: "en",
    status: "completed",
    is_demo: true,
  },
  {
    id: "demo-5",
    title: "Architecture Discussion",
    subtitle: "Backend Team",
    created_at: daysAgo(3, 9, 30),
    duration_seconds: 4500,
    language: "en",
    status: "completed",
    is_demo: true,
  },
  {
    id: "demo-6",
    title: "Reuniao de Alinhamento",
    subtitle: "Time Brasil",
    created_at: daysAgo(5, 15, 0),
    duration_seconds: 1500,
    language: "pt-BR",
    status: "completed",
    is_demo: true,
  },
];

export const mockDetails: Record<string, MeetingDetail> = {
  "demo-1": {
    meeting: mockMeetings[0],
    summary: {
      overview:
        "The engineering team reviewed the backlog and committed to 34 story points for the upcoming sprint. Key focus areas include the new auth flow, performance improvements to the dashboard, and finishing the export feature.",
      key_points: [
        "Auth flow migration to OAuth2 starts this sprint",
        "Dashboard load time target: under 2 seconds",
        "Export feature needs QA before release",
        "Two new hires joining next Monday",
      ],
      decisions: [
        "Use Postgres for the new analytics service instead of ClickHouse",
        "Postpone mobile app work to next quarter",
      ],
    },
    transcript: [
      { id: "t1", timestamp: "00:00:12", speaker: "Alex", text: "Alright, let's get started with sprint planning. We've got a few things to cover today." },
      { id: "t2", timestamp: "00:00:28", speaker: "Sarah", text: "I've prioritized the backlog. The auth migration is the biggest item — about 13 points." },
      { id: "t3", timestamp: "00:01:15", speaker: "Alex", text: "That makes sense. We've been putting it off. What about the dashboard performance work?" },
      { id: "t4", timestamp: "00:01:42", speaker: "Jordan", text: "I've been profiling it. Main bottleneck is the chart rendering — I can get it under 2 seconds with lazy loading." },
      { id: "t5", timestamp: "00:02:30", speaker: "Sarah", text: "Perfect. And the export feature just needs QA at this point. Mark, can you pick that up?" },
      { id: "t6", timestamp: "00:02:48", speaker: "Mark", text: "Yeah, I'll have it tested by Wednesday." },
    ],
    action_items: [
      { id: "a1", text: "Start OAuth2 migration — create branch and initial PR", assignee: "Sarah", done: false },
      { id: "a2", text: "Implement lazy loading for dashboard charts", assignee: "Jordan", done: false },
      { id: "a3", text: "QA the export feature by Wednesday", assignee: "Mark", done: false },
      { id: "a4", text: "Prepare onboarding docs for new hires", assignee: "Alex", done: false },
    ],
    notes: "",
  },
  "demo-2": {
    meeting: mockMeetings[1],
    summary: {
      overview:
        "Discussed career growth, current project satisfaction, and upcoming opportunities. Sarah expressed interest in leading the new analytics initiative.",
      key_points: [
        "Performance review coming up next month",
        "Interest in tech lead role for analytics project",
        "Current workload is manageable",
      ],
      decisions: [
        "Sarah will draft a proposal for the analytics project architecture",
      ],
    },
    transcript: [
      { id: "t1", timestamp: "00:00:05", speaker: "You", text: "Hey Sarah, how's everything going?" },
      { id: "t2", timestamp: "00:00:12", speaker: "Sarah", text: "Good! I've been thinking about the analytics project — I'd love to take the lead on that." },
      { id: "t3", timestamp: "00:00:45", speaker: "You", text: "I think that'd be great. Why don't you put together an architecture proposal?" },
    ],
    action_items: [
      { id: "a1", text: "Draft analytics project architecture proposal", assignee: "Sarah", done: false },
      { id: "a2", text: "Schedule performance review", assignee: "You", done: false },
    ],
    notes: "",
  },
  "demo-3": {
    meeting: mockMeetings[2],
    summary: {
      overview:
        "Product and design teams reviewed the latest mockups for the settings redesign. Several usability improvements were identified and a revised timeline was agreed upon.",
      key_points: [
        "Settings page needs better information hierarchy",
        "Dark mode toggle should be more prominent",
        "Mobile layout needs responsive adjustments",
        "Launch target: end of month",
      ],
      decisions: [
        "Move to a tabbed layout for settings categories",
        "Add inline validation for API key fields",
      ],
    },
    transcript: [
      { id: "t1", timestamp: "00:00:10", speaker: "Lisa", text: "Let me share my screen — I've updated the settings mockups based on last week's feedback." },
      { id: "t2", timestamp: "00:01:20", speaker: "Tom", text: "Much better. But I think the dark mode toggle should be right at the top, not buried in appearance settings." },
      { id: "t3", timestamp: "00:02:05", speaker: "Lisa", text: "Good call. I'll move it up. What about the tabs approach for categories?" },
      { id: "t4", timestamp: "00:02:30", speaker: "You", text: "Tabs make sense. It's cleaner than the long scrolling page we have now." },
    ],
    action_items: [
      { id: "a1", text: "Update mockups with tabbed layout", assignee: "Lisa", done: false },
      { id: "a2", text: "Add inline validation to API key inputs", assignee: "Tom", done: false },
      { id: "a3", text: "Test responsive layout on mobile viewports", assignee: "Lisa", done: false },
    ],
    notes: "",
  },
  "demo-4": {
    meeting: mockMeetings[3],
    summary: {
      overview:
        "Onboarding call with Acme Corp's team. Covered product setup, integration requirements, and training schedule. They need SSO integration and a custom webhook endpoint.",
      key_points: [
        "Acme needs SSO via SAML",
        "Custom webhook for their internal tooling",
        "Training sessions scheduled for next two weeks",
        "Go-live target: March 15",
      ],
      decisions: [
        "Provide a staging environment by Friday",
        "Weekly sync calls until go-live",
      ],
    },
    transcript: [
      { id: "t1", timestamp: "00:00:15", speaker: "You", text: "Welcome everyone! Let's walk through the onboarding process." },
      { id: "t2", timestamp: "00:00:45", speaker: "Client (Dave)", text: "Thanks. Our main concern is SSO — we use SAML across all our tools." },
      { id: "t3", timestamp: "00:01:30", speaker: "You", text: "We support SAML. I'll send you the integration docs after this call." },
    ],
    action_items: [
      { id: "a1", text: "Send SAML integration documentation to Acme", assignee: "You", done: false },
      { id: "a2", text: "Set up staging environment for Acme", assignee: "DevOps", done: false },
      { id: "a3", text: "Schedule training sessions (2 weeks)", assignee: "You", done: false },
    ],
    notes: "",
  },
  "demo-5": {
    meeting: mockMeetings[4],
    summary: {
      overview:
        "The backend team discussed the migration from a monolithic API to a service-oriented architecture. Key services were identified and a phased migration plan was outlined.",
      key_points: [
        "Auth service should be extracted first",
        "Shared database during transition period",
        "Need to set up service mesh for inter-service communication",
        "Estimated 3-month migration timeline",
      ],
      decisions: [
        "Use gRPC for internal service communication",
        "Keep REST for public-facing APIs",
        "Auth service extraction starts next sprint",
      ],
    },
    transcript: [
      { id: "t1", timestamp: "00:00:20", speaker: "Alex", text: "We need to talk about breaking up the monolith. It's getting harder to deploy independently." },
      { id: "t2", timestamp: "00:01:10", speaker: "Jordan", text: "I'd suggest starting with the auth service — it has the clearest boundaries." },
      { id: "t3", timestamp: "00:02:00", speaker: "Alex", text: "Agreed. What about communication between services? REST or gRPC?" },
      { id: "t4", timestamp: "00:02:30", speaker: "Jordan", text: "gRPC internally for performance. REST stays for public APIs." },
    ],
    action_items: [
      { id: "a1", text: "Draft service boundary diagram", assignee: "Jordan", done: false },
      { id: "a2", text: "Research service mesh options (Istio vs Linkerd)", assignee: "Alex", done: false },
      { id: "a3", text: "Create auth service extraction RFC", assignee: "Jordan", done: false },
    ],
    notes: "",
  },
  "demo-6": {
    meeting: mockMeetings[5],
    summary: {
      overview:
        "Reuniao de alinhamento com o time Brasil sobre o lancamento da versao em portugues. Discutimos traducoes, testes com usuarios brasileiros e timeline.",
      key_points: [
        "Traducoes do app 80% completas",
        "Precisa de revisao por falante nativo",
        "Testes com 5 usuarios agendados para proxima semana",
        "Lancamento pt-BR previsto para fim do mes",
      ],
      decisions: [
        "Contratar revisor freelancer para traducoes",
        "Adicionar suporte a formato de data brasileiro",
      ],
    },
    transcript: [
      { id: "t1", timestamp: "00:00:10", speaker: "Voce", text: "Vamos discutir o progresso das traducoes para portugues." },
      { id: "t2", timestamp: "00:00:35", speaker: "Ana", text: "Estamos com 80% das strings traduzidas. Falta a parte de configuracoes e mensagens de erro." },
      { id: "t3", timestamp: "00:01:20", speaker: "Voce", text: "Otimo. Precisamos de uma revisao por alguem nativo antes de lancar." },
    ],
    action_items: [
      { id: "a1", text: "Finalizar traducoes restantes (configuracoes + erros)", assignee: "Ana", done: false },
      { id: "a2", text: "Encontrar revisor freelancer para pt-BR", assignee: "Voce", done: false },
      { id: "a3", text: "Agendar testes com usuarios brasileiros", assignee: "Ana", done: false },
    ],
    notes: "",
  },
};

export function getMockDetail(id: string): MeetingDetail | undefined {
  return mockDetails[id];
}
