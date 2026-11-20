// Client-safe runbook definitions: categories, the standard template and health maths.

export const TASK_CATEGORIES = ["Planning", "Venue", "Team", "Speakers", "Sponsors", "Finance", "Marketing", "Production", "Logistics", "Day of", "Follow-up", "General"] as const;
export const TASK_STATUSES = ["TODO", "IN_PROGRESS", "BLOCKED", "DONE"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];
export const TASK_STATUS_LABELS: Record<TaskStatus, string> = { TODO: "To do", IN_PROGRESS: "In progress", BLOCKED: "Blocked", DONE: "Done" };
export const TASK_STATUS_STYLES: Record<TaskStatus, string> = {
  TODO: "bg-surface text-ink ring-line",
  IN_PROGRESS: "bg-sky-50 text-sky-800 ring-sky-200",
  BLOCKED: "bg-rose-50 text-rose-800 ring-rose-200",
  DONE: "bg-emerald-50 text-emerald-800 ring-emerald-200",
};
export const TASK_PRIORITIES = ["LOW", "NORMAL", "HIGH"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

/** Tasks the platform can tick off by itself, from what's already in SpeakerDesk. */
export const AUTO_CHECKS = {
  venue_set: "Venue and address are set",
  team_has_reviewers: "At least one reviewer is on the team",
  prospectus_published: "Sponsor prospectus is published",
  cfp_published: "Call for papers is published",
  cfp_closed: "Call for papers has closed",
  proposals_reviewed: "Every proposal has a review",
  decisions_published: "Every proposal has a published decision",
  programme_published: "Programme is published",
  budget_reached: "Secured income reaches the budget target",
  sponsor_deliverables: "All confirmed sponsors delivered everything",
} as const;
export type AutoCheck = keyof typeof AUTO_CHECKS;

type TemplateTask = { title: string; category: (typeof TASK_CATEGORIES)[number]; offset: number; priority?: TaskPriority; autoCheck?: AutoCheck; description?: string };

/** A standard conference runbook. `offset` is days relative to the event's start date. */
export const STANDARD_RUNBOOK: TemplateTask[] = [
  { title: "Set the budget target", category: "Finance", offset: -180, priority: "HIGH" },
  { title: "Book the venue", category: "Venue", offset: -170, priority: "HIGH", autoCheck: "venue_set" },
  { title: "Recruit a review committee", category: "Team", offset: -160, autoCheck: "team_has_reviewers" },
  { title: "Publish the sponsor prospectus", category: "Sponsors", offset: -150, priority: "HIGH", autoCheck: "prospectus_published" },
  { title: "Publish the call for papers", category: "Speakers", offset: -140, priority: "HIGH", autoCheck: "cfp_published" },
  { title: "Launch the website and ticket sales", category: "Marketing", offset: -130 },
  { title: "Close the call for papers", category: "Speakers", offset: -90, autoCheck: "cfp_closed" },
  { title: "Review every proposal", category: "Speakers", offset: -80, autoCheck: "proposals_reviewed" },
  { title: "Send speaker decisions", category: "Speakers", offset: -70, priority: "HIGH", autoCheck: "decisions_published" },
  { title: "Publish the programme", category: "Marketing", offset: -60, autoCheck: "programme_published" },
  { title: "Reach the budget target", category: "Finance", offset: -60, priority: "HIGH", autoCheck: "budget_reached" },
  { title: "Book speaker travel and hotels", category: "Logistics", offset: -50 },
  { title: "Order AV from the production checklist", category: "Production", offset: -30, description: "Use the production checklist on the Programme tab." },
  { title: "Confirm catering and dietary counts", category: "Logistics", offset: -21 },
  { title: "Collect sponsor deliverables", category: "Sponsors", offset: -21, autoCheck: "sponsor_deliverables" },
  { title: "Print badges and signage", category: "Logistics", offset: -14 },
  { title: "Brief volunteers and share the schedule", category: "Team", offset: -7 },
  { title: "Plan the green room and speaker tech checks", category: "Production", offset: -3 },
  { title: "Staff the registration desk", category: "Day of", offset: 0, priority: "HIGH" },
  { title: "Run of show with the stage manager", category: "Day of", offset: 0, priority: "HIGH" },
  { title: "Send thank-you notes to speakers and sponsors", category: "Follow-up", offset: 3 },
  { title: "Hold a team retrospective", category: "Follow-up", offset: 10 },
  { title: "Publish the recordings", category: "Follow-up", offset: 14 },
  { title: "Close the books and send final invoices", category: "Finance", offset: 30 },
];

export type HealthTask = { status: TaskStatus; dueDate: Date | null; priority: TaskPriority };
export type Health = {
  level: "on-track" | "at-risk" | "off-track" | "empty";
  total: number;
  done: number;
  overdue: number;
  overdueHigh: number;
  blocked: number;
  dueThisWeek: number;
  pct: number;      // share of tasks done
  expected: number; // share of tasks that should be done by today
};

export const HEALTH_LABELS: Record<Health["level"], string> = { "on-track": "On track", "at-risk": "At risk", "off-track": "Off track", empty: "No runbook yet" };
export const HEALTH_STYLES: Record<Health["level"], string> = {
  "on-track": "bg-emerald-50 text-emerald-800 ring-emerald-200",
  "at-risk": "bg-amber-50 text-amber-800 ring-amber-200",
  "off-track": "bg-rose-50 text-rose-800 ring-rose-200",
  empty: "bg-neutral-100 text-ink-soft ring-line",
};

export function startOfToday(now = new Date()) {
  const d = new Date(now);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export const isOverdue = (t: { status: TaskStatus; dueDate: Date | null }, today: Date) => t.status !== "DONE" && !!t.dueDate && t.dueDate < today;

export function runbookHealth(tasks: HealthTask[], now = new Date()): Health {
  const today = startOfToday(now);
  const weekEnd = new Date(today.getTime() + 7 * 86_400_000);
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === "DONE").length;
  const overdueTasks = tasks.filter((t) => isOverdue(t, today));
  const overdue = overdueTasks.length;
  const overdueHigh = overdueTasks.filter((t) => t.priority === "HIGH").length;
  const blocked = tasks.filter((t) => t.status === "BLOCKED").length;
  const dueThisWeek = tasks.filter((t) => t.status !== "DONE" && t.dueDate && t.dueDate >= today && t.dueDate < weekEnd).length;
  const dueByNow = tasks.filter((t) => t.dueDate && t.dueDate < today).length;
  const level: Health["level"] = !total ? "empty" : overdue >= 3 || overdueHigh > 0 ? "off-track" : overdue > 0 || blocked > 0 ? "at-risk" : "on-track";
  return { level, total, done, overdue, overdueHigh, blocked, dueThisWeek, pct: total ? done / total : 0, expected: total ? dueByNow / total : 0 };
}
