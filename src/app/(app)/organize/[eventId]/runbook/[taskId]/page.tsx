import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ActionButton } from "@/components/form-controls";
import { TaskForm } from "@/components/organizer/runbook-controls";
import { Card, Skeleton, toDateInput } from "@/components/ui";
import { deleteTask, updateTask } from "@/lib/actions/runbook";
import { prisma } from "@/lib/db";
import { requireEventAccess } from "@/lib/organizer";
import { AUTO_CHECKS, type AutoCheck } from "@/lib/runbook";

export const metadata: Metadata = { title: "Edit task" };

type Props = PageProps<"/organize/[eventId]/runbook/[taskId]">;

export default function TaskPage(props: Props) {
  return (
    <Suspense fallback={<Skeleton rows={3} />}>
      <EditTask params={props.params} />
    </Suspense>
  );
}

async function EditTask({ params }: { params: Props["params"] }) {
  const { eventId, taskId } = await params;
  await requireEventAccess(eventId, "ORGANIZER");
  const [task, members] = await Promise.all([
    prisma.runbookTask.findFirst({ where: { id: taskId, eventId } }),
    prisma.eventMember.findMany({ where: { eventId }, include: { user: { select: { id: true, name: true } } } }),
  ]);
  if (!task) notFound();
  return (
    <div className="space-y-6">
      <Card title="Edit task" description={task.autoCheck ? `Ticks itself off when: ${AUTO_CHECKS[task.autoCheck as AutoCheck]}.` : undefined}>
        <TaskForm
          members={members.map((m) => ({ id: m.user.id, name: m.user.name }))}
          action={updateTask.bind(null, task.id)}
          submitLabel="Save task"
          cancelHref={`/organize/${eventId}/runbook`}
          values={{ title: task.title, description: task.description, category: task.category, dueDate: toDateInput(task.dueDate), priority: task.priority, status: task.status, assigneeId: task.assigneeId ?? "" }}
        />
      </Card>
      <div className="flex justify-end">
        <ActionButton action={deleteTask.bind(null, task.id)} variant="danger" confirmText="Delete this task?">Delete task</ActionButton>
      </div>
    </div>
  );
}
