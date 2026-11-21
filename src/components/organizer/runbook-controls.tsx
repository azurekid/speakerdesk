"use client";

import Link from "next/link";
import { useEffect, useRef, useTransition } from "react";
import { FormMessage, SubmitButton, useFormAction } from "@/components/form-controls";
import { buttonClass, cx, Field } from "@/components/ui";
import { assignTask, setTaskStatus } from "@/lib/actions/runbook";
import { TASK_CATEGORIES, TASK_STATUS_LABELS, TASK_STATUS_STYLES, TASK_STATUSES, type TaskStatus } from "@/lib/runbook";
import type { ActionState } from "@/lib/validation";

export function TaskStatusSelect({ id, status, disabled }: { id: string; status: TaskStatus; disabled?: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <select
      aria-label="Task status"
      defaultValue={status}
      disabled={disabled || pending}
      onChange={(e) => {
        const next = e.target.value as TaskStatus;
        startTransition(() => setTaskStatus(id, next));
      }}
      className={cx("rounded-full border-0 py-1.5 pl-3 pr-8 text-base font-medium ring-1 ring-inset disabled:opacity-100 sm:py-1 sm:pl-2.5 sm:pr-7 sm:text-xs", TASK_STATUS_STYLES[status], pending && "opacity-60")}
    >
      {TASK_STATUSES.map((s) => <option key={s} value={s}>{TASK_STATUS_LABELS[s]}</option>)}
    </select>
  );
}

export function TaskAssigneeSelect({ id, assigneeId, members }: { id: string; assigneeId: string | null; members: { id: string; name: string }[] }) {
  const [pending, startTransition] = useTransition();
  return (
    <select
      aria-label="Assignee"
      defaultValue={assigneeId ?? ""}
      disabled={pending}
      onChange={(e) => {
        const next = e.target.value;
        startTransition(() => assignTask(id, next));
      }}
      className={cx("max-w-44 truncate rounded-lg border-0 bg-transparent py-1.5 pl-1 pr-7 text-base text-ink-soft hover:bg-neutral-100 sm:max-w-36 sm:py-1 sm:pr-6 sm:text-xs", pending && "opacity-60")}
    >
      <option value="">Unassigned</option>
      {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
    </select>
  );
}

export type TaskFormValues = {
  title: string; description: string; category: string; dueDate: string; priority: "LOW" | "NORMAL" | "HIGH"; status: TaskStatus; assigneeId: string;
};

export function TaskForm({ values, members, action, submitLabel, cancelHref, compact }: {
  values: TaskFormValues;
  members: { id: string; name: string }[];
  action: (prev: ActionState, form: FormData) => Promise<ActionState>;
  submitLabel: string;
  cancelHref?: string;
  compact?: boolean;
}) {
  const [state, onSubmit, pending] = useFormAction(action, undefined);
  const e = state?.errors;
  const formRef = useRef<HTMLFormElement>(null);
  // Clear the quick-add form after each successful create (edit forms redirect instead).
  useEffect(() => {
    if (state?.ok && compact) formRef.current?.reset();
  }, [state, compact]);
  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-4">
      <div className={cx("grid gap-4", compact ? "sm:grid-cols-[2fr_1fr_1fr_1fr]" : "sm:grid-cols-2")}>
        <Field label="Task" htmlFor="title" error={e?.title} className={compact ? "" : "sm:col-span-2"}>
          <input id="title" name="title" defaultValue={values.title} placeholder="e.g. Confirm the photographer" className="control" />
        </Field>
        <Field label="Due" htmlFor="dueDate" error={e?.dueDate}>
          <input id="dueDate" name="dueDate" type="date" defaultValue={values.dueDate} className="control" />
        </Field>
        <Field label="Category" htmlFor="category" error={e?.category}>
          <select id="category" name="category" defaultValue={values.category} className="control">
            {TASK_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Owner" htmlFor="assigneeId" error={e?.assigneeId}>
          <select id="assigneeId" name="assigneeId" defaultValue={values.assigneeId} className="control">
            <option value="">Unassigned</option>
            {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </Field>
        {!compact && (
          <>
            <Field label="Priority" htmlFor="priority">
              <select id="priority" name="priority" defaultValue={values.priority} className="control">
                <option value="LOW">Low</option>
                <option value="NORMAL">Normal</option>
                <option value="HIGH">High</option>
              </select>
            </Field>
            <Field label="Status" htmlFor="status">
              <select id="status" name="status" defaultValue={values.status} className="control">
                {TASK_STATUSES.map((s) => <option key={s} value={s}>{TASK_STATUS_LABELS[s]}</option>)}
              </select>
            </Field>
            <Field label="Notes" htmlFor="description" className="sm:col-span-2">
              <textarea id="description" name="description" rows={4} defaultValue={values.description} className="control" placeholder="Links, contacts, what done looks like…" />
            </Field>
          </>
        )}
      </div>
      {compact && (
        <>
          <input type="hidden" name="priority" value="NORMAL" />
          <input type="hidden" name="status" value="TODO" />
        </>
      )}
      <div className="flex items-center gap-3">
        <SubmitButton pending={pending}>{submitLabel}</SubmitButton>
        {cancelHref && <Link href={cancelHref} className={buttonClass("ghost")}>Cancel</Link>}
        <FormMessage state={state} />
      </div>
    </form>
  );
}
