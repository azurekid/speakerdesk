import { AlertTriangle, CalendarClock, CheckCircle2, Flag, Sparkles, Zap } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ActionButton } from "@/components/form-controls";
import { TaskAssigneeSelect, TaskForm, TaskStatusSelect } from "@/components/organizer/runbook-controls";
import { Badge, Card, cx, EmptyState, formatDate, Skeleton } from "@/components/ui";
import { applyTemplate, createTask } from "@/lib/actions/runbook";
import { prisma } from "@/lib/db";
import { requireEventAccess } from "@/lib/organizer";
import { canManage } from "@/lib/permissions";
import { AUTO_CHECKS, type AutoCheck, HEALTH_LABELS, HEALTH_STYLES, isOverdue, startOfToday, TASK_CATEGORIES } from "@/lib/runbook";
import { getRunbook, type RunbookTaskView } from "@/lib/runbook-queries";

export const metadata: Metadata = { title: "Runbook" };

type Props = PageProps<"/organize/[eventId]/runbook">;

export default function RunbookPage(props: Props) {
  return (
    <Suspense fallback={<Skeleton rows={5} />}>
      <Runbook params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

const DAY = 86_400_000;

function relative(due: Date, today: Date) {
  const days = Math.round((due.getTime() - today.getTime()) / DAY);
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  return days < 0 ? `${-days} days late` : `in ${days} days`;
}

async function Runbook({ params, searchParams }: { params: Props["params"]; searchParams: Props["searchParams"] }) {
  const { eventId } = await params;
  const sp = await searchParams;
  const { user, event, role } = await requireEventAccess(eventId, "VOLUNTEER");
  const manager = canManage(role);
  const [{ tasks, health }, members] = await Promise.all([
    getRunbook(eventId),
    prisma.eventMember.findMany({ where: { eventId }, include: { user: { select: { id: true, name: true } } }, orderBy: { createdAt: "asc" } }),
  ]);
  const people = members.map((m) => ({ id: m.user.id, name: m.user.name }));
  const today = startOfToday();
  const weekEnd = new Date(today.getTime() + 7 * DAY);
  const monthEnd = new Date(today.getTime() + 30 * DAY);
  const daysToEvent = event.startDate ? Math.ceil((event.startDate.getTime() - today.getTime()) / DAY) : null;

  const filter = sp.view === "mine" ? "mine" : sp.view === "overdue" ? "overdue" : "all";
  const category = typeof sp.category === "string" && (TASK_CATEGORIES as readonly string[]).includes(sp.category) ? sp.category : undefined;
  let visible = tasks;
  if (filter === "mine") visible = visible.filter((t) => t.assigneeId === user.id);
  if (filter === "overdue") visible = visible.filter((t) => isOverdue({ status: t.effectiveStatus, dueDate: t.dueDate }, today));
  if (category) visible = visible.filter((t) => t.category === category);

  const open = visible.filter((t) => t.effectiveStatus !== "DONE");
  const groups: { title: string; tone?: string; items: RunbookTaskView[] }[] = [
    { title: "Overdue", tone: "text-rose-700", items: open.filter((t) => t.dueDate && t.dueDate < today) },
    { title: "This week", items: open.filter((t) => t.dueDate && t.dueDate >= today && t.dueDate < weekEnd) },
    { title: "Next 30 days", items: open.filter((t) => t.dueDate && t.dueDate >= weekEnd && t.dueDate < monthEnd) },
    { title: "Later", items: open.filter((t) => t.dueDate && t.dueDate >= monthEnd) },
    { title: "No due date", items: open.filter((t) => !t.dueDate) },
  ];
  const done = visible.filter((t) => t.effectiveStatus === "DONE");

  const categories = TASK_CATEGORIES.map((c) => {
    const ts = tasks.filter((t) => t.category === c);
    return { c, total: ts.length, done: ts.filter((t) => t.effectiveStatus === "DONE").length, overdue: ts.filter((t) => isOverdue({ status: t.effectiveStatus, dueDate: t.dueDate }, today)).length };
  }).filter((x) => x.total);
  const workload = [...people, { id: "", name: "Unassigned" }]
    .map((p) => {
      const ts = tasks.filter((t) => (t.assigneeId ?? "") === p.id && t.effectiveStatus !== "DONE");
      return { ...p, open: ts.length, overdue: ts.filter((t) => isOverdue({ status: t.effectiveStatus, dueDate: t.dueDate }, today)).length };
    })
    .filter((p) => p.open);

  const href = (next: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries({ view: filter === "all" ? undefined : filter, category, ...next })) if (v) q.set(k, v);
    const s = q.toString();
    return `/organize/${eventId}/runbook${s ? `?${s}` : ""}`;
  };
  const pill = (active: boolean) => cx("rounded-lg px-3 py-1 text-sm", active ? "bg-ink text-paper" : "text-ink-soft hover:bg-neutral-100");

  if (!tasks.length) {
    return (
      <EmptyState
        title="Plan the event with a runbook"
        photo="/images/events/hall.jpg"
        action={manager && (
          <ActionButton action={applyTemplate.bind(null, eventId)} variant="accent">
            Start with the standard conference runbook ({event.startDate ? "timed to your event date" : "set an event date for exact timing"})
          </ActionButton>
        )}
      >
        24 tasks from booking the venue to the retrospective, each with a due date relative to the event, and ten of them tick themselves off as you publish the CfP, reach your budget and more.
      </EmptyState>
    );
  }

  return (
    <div className="space-y-8">
      {/* Health header */}
      <section className="grid gap-6 rounded-2xl border border-line bg-surface p-6 lg:grid-cols-[1fr_auto]">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <Badge className={cx("px-3 py-1 text-sm", HEALTH_STYLES[health.level])}>{HEALTH_LABELS[health.level]}</Badge>
            {daysToEvent !== null && (
              <span className="text-sm text-ink-soft">
                {daysToEvent > 0 ? `${daysToEvent} days to go` : daysToEvent === 0 ? "It's event day!" : `Event was ${-daysToEvent} days ago`}
              </span>
            )}
          </div>
          <p className="mt-3 text-4xl font-semibold tracking-tight tabular-nums">
            {Math.round(health.pct * 100)}%<span className="ml-2 text-base font-normal text-ink-soft">complete · {health.done} of {health.total} tasks</span>
          </p>
          <div className="relative mt-4 h-2.5 rounded-full bg-neutral-100">
            <div className={cx("h-full rounded-full", health.level === "off-track" ? "bg-rose-500" : health.level === "at-risk" ? "bg-amber-500" : "bg-emerald-500")} style={{ width: `${health.pct * 100}%` }} />
            <div className="absolute -top-1 h-4.5 w-0.5 bg-ink" style={{ left: `${health.expected * 100}%` }} title="Where you should be today" />
          </div>
          <p className="mt-2 text-xs text-ink-soft">The black marker shows where you should be today, based on due dates.</p>
        </div>
        <dl className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm sm:grid-cols-4 lg:grid-cols-2">
          <Metric icon={<AlertTriangle className="size-4 text-rose-600" />} label="Overdue" value={health.overdue} href={href({ view: "overdue" })} />
          <Metric icon={<CalendarClock className="size-4 text-sky-600" />} label="Due this week" value={health.dueThisWeek} />
          <Metric icon={<Flag className="size-4 text-amber-600" />} label="Blocked" value={health.blocked} />
          <Metric icon={<CheckCircle2 className="size-4 text-emerald-600" />} label="Done" value={health.done} />
        </dl>
      </section>

      <div className="grid gap-8 lg:grid-cols-[1fr_280px]">
        <div className="min-w-0 space-y-6">
          <div className="flex flex-wrap items-center gap-1">
            <Link href={href({ view: undefined })} className={pill(filter === "all")}>All tasks</Link>
            <Link href={href({ view: "mine" })} className={pill(filter === "mine")}>My tasks</Link>
            <Link href={href({ view: "overdue" })} className={pill(filter === "overdue")}>Overdue</Link>
            {category && <Link href={href({ category: undefined })} className="ml-2 rounded-lg bg-neutral-100 px-3 py-1 text-sm">× {category}</Link>}
          </div>

          {manager && (
            <details className="group rounded-2xl border border-line bg-surface">
              <summary className="cursor-pointer list-none px-5 py-3 text-sm font-medium">+ Add a task</summary>
              <div className="border-t border-line p-5">
                <TaskForm compact members={people} action={createTask.bind(null, eventId)} submitLabel="Add task" values={{ title: "", description: "", category: "General", dueDate: "", priority: "NORMAL", status: "TODO", assigneeId: "" }} />
              </div>
            </details>
          )}

          {groups.map((g) => g.items.length > 0 && (
            <section key={g.title}>
              <h2 className={cx("mb-2 text-sm font-semibold", g.tone)}>{g.title} <span className="font-normal text-ink-soft">({g.items.length})</span></h2>
              <TaskList tasks={g.items} today={today} eventId={eventId} manager={manager} userId={user.id} people={people} />
            </section>
          ))}
          {open.length === 0 && <p className="rounded-2xl border border-dashed border-line px-5 py-8 text-center text-sm text-ink-soft">Nothing open here. 🎉</p>}

          {done.length > 0 && (
            <details className="rounded-2xl border border-line bg-surface">
              <summary className="cursor-pointer list-none px-5 py-3 text-sm font-medium">Done ({done.length})</summary>
              <div className="border-t border-line">
                <TaskList tasks={done} today={today} eventId={eventId} manager={manager} userId={user.id} people={people} flat />
              </div>
            </details>
          )}
        </div>

        <aside className="space-y-6">
          <Card title="By area">
            <ul className="space-y-3">
              {categories.map((c) => (
                <li key={c.c}>
                  <Link href={href({ category: c.c })} className="block hover:opacity-80">
                    <div className="flex justify-between text-sm">
                      <span>{c.c}{c.overdue > 0 && <span className="ml-1.5 text-xs text-rose-700">{c.overdue} late</span>}</span>
                      <span className="tabular-nums text-ink-soft">{c.done}/{c.total}</span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-neutral-100">
                      <div className={cx("h-full rounded-full", c.overdue ? "bg-amber-500" : "bg-emerald-500")} style={{ width: `${(c.done / c.total) * 100}%` }} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
          <Card title="Workload" description="Open tasks per person">
            {workload.length === 0 ? (
              <p className="text-sm text-ink-soft">Nothing open.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {workload.map((p) => (
                  <li key={p.id || "none"} className="flex items-center justify-between gap-2">
                    <span className={cx("truncate", !p.id && "text-ink-soft")}>{p.name}</span>
                    <span className="flex items-center gap-2 tabular-nums">
                      {p.overdue > 0 && <span className="text-xs text-rose-700">{p.overdue} late</span>}
                      <span className="rounded-full bg-neutral-100 px-2 text-xs">{p.open}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          {manager && (
            <Card title="Template">
              <p className="mb-3 text-sm text-ink-soft">Add any standard tasks that are missing.</p>
              <ActionButton action={applyTemplate.bind(null, eventId)}>Add missing standard tasks</ActionButton>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}

function Metric({ icon, label, value, href }: { icon: React.ReactNode; label: string; value: number; href?: string }) {
  const body = (
    <div>
      <dt className="flex items-center gap-1.5 text-xs text-ink-soft">{icon}{label}</dt>
      <dd className="text-2xl font-semibold tabular-nums">{value}</dd>
    </div>
  );
  return href && value ? <Link href={href} className="hover:opacity-75">{body}</Link> : body;
}

function TaskList({ tasks, today, eventId, manager, userId, people, flat }: {
  tasks: RunbookTaskView[]; today: Date; eventId: string; manager: boolean; userId: string; people: { id: string; name: string }[]; flat?: boolean;
}) {
  return (
    <ul className={cx("divide-y divide-line", !flat && "rounded-2xl border border-line bg-surface")}>
      {tasks.map((t) => {
        const late = isOverdue({ status: t.effectiveStatus, dueDate: t.dueDate }, today);
        const mine = t.assigneeId === userId;
        return (
          <li key={t.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
            {t.autoCheck ? (
              <span title={AUTO_CHECKS[t.autoCheck as AutoCheck]}>
                <Badge className={t.autoDone ? "bg-emerald-50 text-emerald-800 ring-emerald-200" : "bg-surface text-ink-soft ring-line"}>
                  <Zap className="size-3" />{t.autoDone ? "Done" : "Auto"}
                </Badge>
              </span>
            ) : (
              <TaskStatusSelect key={`${t.id}-${t.status}`} id={t.id} status={t.status} disabled={!manager && !mine} />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                {t.priority === "HIGH" && <Flag className="size-3.5 shrink-0 fill-brand-500 text-brand-500" aria-label="High priority" />}
                {manager ? (
                  <Link href={`/organize/${eventId}/runbook/${t.id}`} className={cx("truncate text-sm font-medium hover:text-brand-700", t.effectiveStatus === "DONE" && "text-ink-soft line-through")}>{t.title}</Link>
                ) : (
                  <span className={cx("truncate text-sm font-medium", t.effectiveStatus === "DONE" && "text-ink-soft line-through")}>{t.title}</span>
                )}
              </div>
              <p className="text-xs text-ink-soft">
                {t.category}
                {t.autoCheck && !t.autoDone && <> · <Sparkles className="inline size-3" /> {AUTO_CHECKS[t.autoCheck as AutoCheck]}</>}
              </p>
            </div>
            {t.dueDate && (
              <span className={cx("whitespace-nowrap text-xs tabular-nums", late ? "font-medium text-rose-700" : "text-ink-soft")} title={formatDate(t.dueDate)}>
                {t.effectiveStatus === "DONE" ? formatDate(t.dueDate) : relative(t.dueDate, today)}
              </span>
            )}
            {manager ? (
              <TaskAssigneeSelect key={`${t.id}-${t.assigneeId}`} id={t.id} assigneeId={t.assigneeId} members={people} />
            ) : (
              <span className="w-28 truncate text-right text-xs text-ink-soft">{t.assignee?.name ?? "Unassigned"}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
