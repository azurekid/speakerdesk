import "server-only";
import { summarizeBudget } from "@/lib/budget";
import { prisma } from "@/lib/db";
import { cfpState } from "@/lib/domain";
import { type AutoCheck, AUTO_CHECKS, runbookHealth, type TaskStatus } from "@/lib/runbook";

/** Evaluates every auto-check for an event in one go. */
async function evaluateAutoChecks(eventId: string): Promise<Record<AutoCheck, boolean>> {
  const [event, reviewers, proposals, deals] = await Promise.all([
    prisma.event.findUniqueOrThrow({ where: { id: eventId } }),
    prisma.eventMember.count({ where: { eventId, role: "REVIEWER" } }),
    prisma.proposal.findMany({ where: { eventId, withdrawn: false }, select: { decision: true, decisionPublished: true, _count: { select: { reviews: true } } } }),
    prisma.sponsorship.findMany({ where: { eventId }, select: { status: true, completedDeliverables: true, items: { select: { price: true, deliverables: true } } } }),
  ]);
  const confirmed = deals.filter((d) => ["APPROVED", "INVOICED", "PAID"].includes(d.status));
  const budget = summarizeBudget(event.budgetTarget, event.otherIncome, deals);
  return {
    venue_set: Boolean(event.venue && (event.address || event.location)),
    team_has_reviewers: reviewers > 0,
    prospectus_published: event.sponsorshipOpen,
    cfp_published: event.cfpPublished,
    cfp_closed: cfpState(event) === "closed",
    proposals_reviewed: proposals.length > 0 && proposals.every((p) => p._count.reviews > 0),
    decisions_published: proposals.length > 0 && proposals.every((p) => p.decision !== "UNDECIDED" && p.decisionPublished),
    programme_published: event.programPublished,
    budget_reached: budget.pct !== null && budget.pct >= 1,
    sponsor_deliverables:
      confirmed.length > 0 && confirmed.every((d) => d.items.flatMap((i) => i.deliverables).every((x) => d.completedDeliverables.includes(x))),
  };
}

/** Runbook tasks with their effective status (auto-checked tasks count as done once their condition holds). */
export async function getRunbook(eventId: string) {
  const [tasks, checks] = await Promise.all([
    prisma.runbookTask.findMany({
      where: { eventId },
      include: { assignee: { select: { id: true, name: true } } },
      orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { sortOrder: "asc" }, { createdAt: "asc" }],
    }),
    evaluateAutoChecks(eventId),
  ]);
  const withStatus = tasks.map((t) => {
    const key = t.autoCheck as AutoCheck | null;
    const autoDone = key && key in AUTO_CHECKS ? checks[key] : false;
    return { ...t, effectiveStatus: (autoDone ? "DONE" : t.status) as TaskStatus, autoDone };
  });
  return { tasks: withStatus, health: runbookHealth(withStatus.map((t) => ({ status: t.effectiveStatus, dueDate: t.dueDate, priority: t.priority }))) };
}
export type RunbookTaskView = Awaited<ReturnType<typeof getRunbook>>["tasks"][number];
