"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTransition } from "react";
import { FormMessage, SubmitButton, useFormAction } from "@/components/form-controls";
import { cx, Field } from "@/components/ui";
import { saveReview, setDecision } from "@/lib/actions/events";
import { DECISION_STYLES, DECISIONS, type Decision } from "@/lib/domain";
import { atLeast, type EventRole } from "@/lib/permissions";

export function EventTabs({ eventId, role }: { eventId: string; role: EventRole }) {
  const pathname = usePathname();
  const base = `/organize/${eventId}`;
  const tabs = [
    { href: base, label: "Overview", exact: true, min: "REVIEWER" as EventRole },
    { href: `${base}/runbook`, label: "Runbook", min: "VOLUNTEER" as EventRole },
    { href: `${base}/proposals`, label: "Proposals", min: "REVIEWER" as EventRole },
    { href: `${base}/program`, label: "Programme", min: "REVIEWER" as EventRole },
    { href: `${base}/sponsors`, label: "Sponsors & budget", min: "ORGANIZER" as EventRole },
    { href: `${base}/team`, label: "Team", min: "VOLUNTEER" as EventRole },
    { href: `${base}/settings`, label: "Settings", min: "ORGANIZER" as EventRole },
  ].filter((t) => atLeast(role, t.min));
  return <TabBar tabs={tabs} isActive={(t) => (t.exact ? pathname === t.href : pathname.startsWith(t.href))} />;
}

export function TabBar<T extends { href: string; label: string }>({ tabs, isActive }: { tabs: T[]; isActive?: (t: T) => boolean }) {
  return (
    <nav className="-mb-px flex gap-6 overflow-x-auto border-b border-line">
      {tabs.map((t) => {
        const active = isActive?.(t) ?? false;
        return (
          <Link key={t.href} href={t.href} className={cx("whitespace-nowrap border-b-2 pb-3 text-sm", active ? "border-brand-600 font-medium text-ink" : "border-transparent text-ink-soft hover:text-ink")}>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

const DECISION_OPTION_LABELS: Record<Decision, string> = { UNDECIDED: "Undecided", ACCEPTED: "Accepted", WAITLISTED: "Waitlisted", REJECTED: "Rejected" };

export function DecisionSelect({ proposalId, decision }: { proposalId: string; decision: Decision }) {
  const [pending, startTransition] = useTransition();
  return (
    <select
      aria-label="Decision"
      defaultValue={decision}
      disabled={pending}
      onChange={(ev) => {
        const next = ev.target.value as Decision;
        startTransition(() => setDecision(proposalId, next));
      }}
      className={cx("rounded border-0 py-1 pl-2 pr-7 text-xs font-medium ring-1 ring-inset", DECISION_STYLES[decision], pending && "opacity-60")}
    >
      {DECISIONS.map((d) => <option key={d} value={d}>{DECISION_OPTION_LABELS[d]}</option>)}
    </select>
  );
}

export function DecisionButtons({ proposalId, decision }: { proposalId: string; decision: Decision }) {
  const [pending, startTransition] = useTransition();
  const options: { value: Decision; label: string; className: string }[] = [
    { value: "ACCEPTED", label: "Accept", className: "aria-pressed:bg-emerald-600 aria-pressed:text-white aria-pressed:ring-emerald-600" },
    { value: "WAITLISTED", label: "Waitlist", className: "aria-pressed:bg-amber-600 aria-pressed:text-white aria-pressed:ring-amber-600" },
    { value: "REJECTED", label: "Reject", className: "aria-pressed:bg-rose-600 aria-pressed:text-white aria-pressed:ring-rose-600" },
  ];
  return (
    <div className="grid grid-cols-3 gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          disabled={pending}
          aria-pressed={decision === o.value}
          onClick={() => startTransition(() => setDecision(proposalId, decision === o.value ? "UNDECIDED" : o.value))}
          className={cx("rounded-md bg-surface px-2 py-2 text-sm font-medium text-ink ring-1 ring-inset ring-line transition hover:ring-ink/40 disabled:opacity-60", o.className)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function ReviewForm({ proposalId, score, comment }: { proposalId: string; score?: number; comment?: string }) {
  const [state, onSubmit, pending] = useFormAction(saveReview.bind(null, proposalId), undefined);
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Your score</legend>
        <div className="grid grid-cols-5 gap-1.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="cursor-pointer">
              <input type="radio" name="score" value={n} defaultChecked={score === n} className="peer sr-only" required />
              <span className="block rounded-md bg-surface py-2 text-center font-display tracking-tight text-lg ring-1 ring-inset ring-line transition peer-checked:bg-ink peer-checked:text-paper peer-checked:ring-ink peer-focus-visible:ring-2 peer-focus-visible:ring-brand-600 hover:ring-ink/40">{n}</span>
            </label>
          ))}
        </div>
        <p className="mt-1 flex justify-between text-[11px] text-ink-soft"><span>Not for us</span><span>Must have</span></p>
        {state?.errors?.score && <p className="mt-1 text-xs text-rose-700">{state.errors.score[0]}</p>}
      </fieldset>
      <Field label="Comment for the team" htmlFor={`comment-${proposalId}`}>
        <textarea id={`comment-${proposalId}`} name="comment" rows={4} defaultValue={comment} className="control" placeholder="Strengths, concerns, fit with the programme…" />
      </Field>
      <div className="flex items-center gap-3">
        <SubmitButton pending={pending}>{score ? "Update review" : "Save review"}</SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
