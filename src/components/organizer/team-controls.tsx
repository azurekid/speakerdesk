"use client";

import { useTransition } from "react";
import { CopyButton, FormMessage, SubmitButton, useFormAction } from "@/components/form-controls";
import { cx, Field } from "@/components/ui";
import { changeMemberRole, inviteMembers } from "@/lib/actions/team";
import { type EventRole, ROLE_DESCRIPTIONS, ROLE_LABELS, ROLE_STYLES } from "@/lib/permissions";

export function InviteForm({ eventId, roles }: { eventId: string; roles: EventRole[] }) {
  const [state, onSubmit, pending] = useFormAction(inviteMembers.bind(null, eventId), undefined);
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="Email addresses" htmlFor="emails" hint="Separate several with commas or new lines. People without an account join automatically when they sign up with this email.">
        <textarea id="emails" name="emails" rows={2} placeholder="alex@example.com, sam@example.com" className="control" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Role" htmlFor="role">
          <select id="role" name="role" defaultValue={roles.includes("ORGANIZER") ? "ORGANIZER" : roles[0]} className="control">
            {roles.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]} — {ROLE_DESCRIPTIONS[r]}</option>)}
          </select>
        </Field>
        <Field label="Title (optional)" htmlFor="title">
          <input id="title" name="title" placeholder="e.g. Sponsorship lead" className="control" />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pending={pending} pendingLabel="Inviting…">Send invites</SubmitButton>
        {state && <FormMessage state={state} />}
      </div>
      {state?.skipped?.length ? <p className="text-xs text-ink-soft">Skipped: {state.skipped.join("; ")}</p> : null}
      {state?.links?.length ? (
        <div className="rounded-xl border border-line bg-neutral-50 p-4">
          <p className="mb-2 text-sm font-medium">Share these invite links</p>
          <p className="mb-3 text-xs text-ink-soft">SpeakerDesk doesn&apos;t send email yet. Each link only works for the invited address and expires in 14 days.</p>
          <ul className="space-y-2">
            {state.links.map((l) => (
              <li key={l.email} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="min-w-40 font-medium">{l.email}</span>
                <code className="min-w-0 flex-1 truncate rounded bg-surface px-2 py-1 text-xs ring-1 ring-line">{l.url}</code>
                <CopyButton text={l.url} label="Copy link" />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </form>
  );
}

export function RoleSelect({ memberId, role, options }: { memberId: string; role: EventRole; options: EventRole[] }) {
  const [pending, startTransition] = useTransition();
  return (
    <select
      aria-label="Role"
      defaultValue={role}
      disabled={pending}
      onChange={(e) => {
        const next = e.target.value as EventRole;
        startTransition(() => changeMemberRole(memberId, next));
      }}
      className={cx("rounded-full border-0 py-1.5 pl-3 pr-8 text-base font-medium ring-1 ring-inset sm:py-1 sm:pl-2.5 sm:pr-7 sm:text-xs", ROLE_STYLES[role], pending && "opacity-60")}
    >
      {options.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
    </select>
  );
}
