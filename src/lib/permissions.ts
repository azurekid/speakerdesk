// Client-safe event roles and what each one may do.

export const EVENT_ROLES = ["OWNER", "ORGANIZER", "REVIEWER", "VOLUNTEER"] as const;
export type EventRole = (typeof EVENT_ROLES)[number];

const RANK: Record<EventRole, number> = { VOLUNTEER: 0, REVIEWER: 1, ORGANIZER: 2, OWNER: 3 };

/** True when `role` has at least the rights of `min`. */
export const atLeast = (role: EventRole, min: EventRole) => RANK[role] >= RANK[min];
/** Run the event: CfP, decisions, sponsors, runbook. */
export const canManage = (role: EventRole) => atLeast(role, "ORGANIZER");
/** Manage the team and delete the event. */
export const canAdmin = (role: EventRole) => role === "OWNER";

export const ROLE_LABELS: Record<EventRole, string> = {
  OWNER: "Owner",
  ORGANIZER: "Co-organizer",
  REVIEWER: "Reviewer",
  VOLUNTEER: "Volunteer",
};

export const ROLE_DESCRIPTIONS: Record<EventRole, string> = {
  OWNER: "Full control, including the team and deleting the event.",
  ORGANIZER: "Runs the event: CfP, decisions, programme, sponsors and the runbook.",
  REVIEWER: "Reads and scores proposals. Sees the runbook and updates their own tasks.",
  VOLUNTEER: "Sees the runbook and updates their own tasks. No access to proposals or money.",
};

export const ROLE_STYLES: Record<EventRole, string> = {
  OWNER: "bg-ink text-paper ring-ink",
  ORGANIZER: "bg-brand-50 text-brand-700 ring-brand-200",
  REVIEWER: "bg-sky-50 text-sky-800 ring-sky-200",
  VOLUNTEER: "bg-neutral-50 text-ink-soft ring-line",
};

/** Rows for the permission matrix shown on the team page. */
export const PERMISSION_MATRIX: { label: string; min: EventRole }[] = [
  { label: "See the runbook and update own tasks", min: "VOLUNTEER" },
  { label: "Read and score proposals", min: "REVIEWER" },
  { label: "Create, assign and edit any task", min: "ORGANIZER" },
  { label: "Edit the event and publish the CfP", min: "ORGANIZER" },
  { label: "Accept / reject and publish decisions", min: "ORGANIZER" },
  { label: "Sponsor packages, deals and budget", min: "ORGANIZER" },
  { label: "Invite people and change roles", min: "OWNER" },
  { label: "Delete the event", min: "OWNER" },
];

/** Roles an inviter may hand out: owners any, co-organizers up to reviewer. */
export function assignableRoles(inviter: EventRole): EventRole[] {
  if (inviter === "OWNER") return [...EVENT_ROLES];
  if (inviter === "ORGANIZER") return ["REVIEWER", "VOLUNTEER"];
  return [];
}
