"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/dal";
import { eventAccessOrNull } from "@/lib/organizer";
import { canManage } from "@/lib/permissions";
import { STANDARD_RUNBOOK, startOfToday, TASK_STATUSES, type TaskStatus } from "@/lib/runbook";
import { type ActionState, fieldErrors, formToObject, taskSchema } from "@/lib/validation";

function revalidate(eventId: string) {
  revalidatePath(`/organize/${eventId}`, "layout");
  revalidatePath("/organize");
}

/** Assignees must be on the event team. */
async function validAssignee(eventId: string, assigneeId: string) {
  if (!assigneeId) return null;
  const member = await prisma.eventMember.findUnique({ where: { eventId_userId: { eventId, userId: assigneeId } } });
  return member ? assigneeId : undefined;
}

export async function createTask(eventId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (!(await eventAccessOrNull(user, eventId, "ORGANIZER"))) return { ok: false, message: "Only owners and co-organizers can add tasks." };
  const parsed = taskSchema.safeParse(formToObject(form));
  if (!parsed.success) return { ok: false, message: "Please fix the highlighted fields.", errors: fieldErrors(parsed.error) };
  const { assigneeId, ...data } = parsed.data;
  const assignee = await validAssignee(eventId, assigneeId);
  if (assignee === undefined) return { ok: false, message: "That person isn't on the team.", errors: { assigneeId: ["Not on the team"] } };
  await prisma.runbookTask.create({ data: { ...data, eventId, assigneeId: assignee, completedAt: data.status === "DONE" ? new Date() : null } });
  revalidate(eventId);
  return { ok: true, message: "Task added." };
}

export async function updateTask(taskId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const task = await prisma.runbookTask.findUnique({ where: { id: taskId } });
  if (!task || !(await eventAccessOrNull(user, task.eventId, "ORGANIZER"))) return { ok: false, message: "Task not found." };
  const parsed = taskSchema.safeParse(formToObject(form));
  if (!parsed.success) return { ok: false, message: "Please fix the highlighted fields.", errors: fieldErrors(parsed.error) };
  const { assigneeId, ...data } = parsed.data;
  const assignee = await validAssignee(task.eventId, assigneeId);
  if (assignee === undefined) return { ok: false, message: "That person isn't on the team.", errors: { assigneeId: ["Not on the team"] } };
  await prisma.runbookTask.update({
    where: { id: taskId },
    data: { ...data, assigneeId: assignee, completedAt: data.status === "DONE" ? (task.completedAt ?? new Date()) : null },
  });
  revalidate(task.eventId);
  redirect(`/organize/${task.eventId}/runbook`);
}

/** Organizers can change any task; everyone else only the tasks assigned to them. */
export async function setTaskStatus(taskId: string, status: TaskStatus): Promise<void> {
  const user = await requireUser();
  if (!TASK_STATUSES.includes(status)) return;
  const task = await prisma.runbookTask.findUnique({ where: { id: taskId } });
  const access = task && (await eventAccessOrNull(user, task.eventId, "VOLUNTEER"));
  if (!task || !access) return;
  if (!canManage(access.role) && task.assigneeId !== user.id) return;
  await prisma.runbookTask.update({ where: { id: taskId }, data: { status, completedAt: status === "DONE" ? new Date() : null } });
  revalidate(task.eventId);
}

export async function assignTask(taskId: string, assigneeId: string): Promise<void> {
  const user = await requireUser();
  const task = await prisma.runbookTask.findUnique({ where: { id: taskId } });
  if (!task || !(await eventAccessOrNull(user, task.eventId, "ORGANIZER"))) return;
  const assignee = await validAssignee(task.eventId, assigneeId);
  if (assignee === undefined) return;
  await prisma.runbookTask.update({ where: { id: taskId }, data: { assigneeId: assignee } });
  revalidate(task.eventId);
}

export async function deleteTask(taskId: string): Promise<void> {
  const user = await requireUser();
  const task = await prisma.runbookTask.findUnique({ where: { id: taskId } });
  if (!task || !(await eventAccessOrNull(user, task.eventId, "ORGANIZER"))) return;
  await prisma.runbookTask.delete({ where: { id: taskId } });
  revalidate(task.eventId);
  redirect(`/organize/${task.eventId}/runbook`);
}

/** Adds the standard conference runbook, timed relative to the event start (skips tasks that already exist). */
export async function applyTemplate(eventId: string): Promise<void> {
  const user = await requireUser();
  const access = await eventAccessOrNull(user, eventId, "ORGANIZER");
  if (!access) return;
  const existing = new Set((await prisma.runbookTask.findMany({ where: { eventId }, select: { title: true } })).map((t) => t.title.toLowerCase()));
  // Without a start date, plan as if the event is ~4 months out.
  const anchor = access.event.startDate ?? new Date(startOfToday().getTime() + 120 * 86_400_000);
  // Planning late? Tasks whose ideal date already passed get a catch-up date a week out
  // instead of starting life overdue.
  const catchUp = new Date(startOfToday().getTime() + 7 * 86_400_000);
  await prisma.runbookTask.createMany({
    data: STANDARD_RUNBOOK.filter((t) => !existing.has(t.title.toLowerCase())).map((t, i) => {
      const ideal = new Date(anchor.getTime() + t.offset * 86_400_000);
      const late = ideal < startOfToday();
      const note = late ? `Catch-up: ideally done ${-t.offset} days before the event.` : "";
      return {
        eventId,
        title: t.title,
        description: [t.description, note].filter(Boolean).join("\n"),
        category: t.category,
        priority: t.priority ?? "NORMAL",
        autoCheck: t.autoCheck ?? null,
        dueDate: late ? catchUp : ideal,
        sortOrder: i,
      };
    }),
  });
  revalidate(eventId);
}
