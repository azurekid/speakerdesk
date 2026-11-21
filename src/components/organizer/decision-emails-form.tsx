"use client";

import { useState } from "react";
import { FormMessage, SubmitButton, useFormAction } from "@/components/form-controls";
import { Card, cx, Field } from "@/components/ui";
import { updateDecisionEmails } from "@/lib/actions/events";
import {
  DECISION_EMAIL_KINDS, DECISION_EMAIL_LABELS, DECISION_PLACEHOLDERS, DEFAULT_DECISION_EMAILS,
  type DecisionEmailKind, type DecisionEmails, renderDecisionEmail,
} from "@/lib/decision-email";

/** The three emails speakers get when decisions are published, with a live preview. */
export function DecisionEmailsForm({ eventId, eventName, eventDates, enabled: initialEnabled, templates }: { eventId: string; eventName: string; eventDates: string; enabled: boolean; templates: DecisionEmails }) {
  const [state, onSubmit, pending] = useFormAction(updateDecisionEmails.bind(null, eventId), undefined);
  const [enabled, setEnabled] = useState(initialEnabled);
  const [tab, setTab] = useState<DecisionEmailKind>("accepted");
  const [values, setValues] = useState(() =>
    Object.fromEntries(DECISION_EMAIL_KINDS.map((k) => [k, {
      subject: templates[k]?.subject || DEFAULT_DECISION_EMAILS[k].subject,
      body: templates[k]?.body || DEFAULT_DECISION_EMAILS[k].body,
    }])) as Record<DecisionEmailKind, { subject: string; body: string }>,
  );
  const set = (kind: DecisionEmailKind, key: "subject" | "body", v: string) => setValues((prev) => ({ ...prev, [kind]: { ...prev[kind], [key]: v } }));
  const preview = renderDecisionEmail(tab, values, {
    SPEAKER_NAME: "Alex Example", SESSION_NAME: "Scaling Kubernetes for Fun", EVENT_NAME: eventName, EVENT_DATES: eventDates,
    EVENT_URL: "https://…/events/your-event", SESSION_URL: "#",
  });
  const buttonText = tab === "accepted" ? "Confirm your session" : "View your submission";
  const e = state?.errors;

  return (
    <Card title="Decision emails" description="Sent to each speaker when you publish decisions. Accepted speakers are asked to confirm they'll be there.">
      <form onSubmit={onSubmit} className="space-y-4">
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="enabled" checked={enabled} onChange={(ev) => setEnabled(ev.target.checked)} className="mt-0.5 accent-ink" />
          <span>
            <span className="font-medium">Email speakers when I publish decisions</span>
            <span className="block text-ink-soft">Off: speakers only see the result in their SpeakerDesk tracker.</span>
          </span>
        </label>
        <div role="tablist" className="flex gap-1 rounded-lg bg-neutral-100 p-1 text-sm">
          {DECISION_EMAIL_KINDS.map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={tab === k}
              onClick={() => setTab(k)}
              className={cx("min-h-9 flex-1 rounded-md px-3", tab === k ? "bg-surface font-medium text-ink shadow-sm" : "text-ink-soft hover:text-ink", (e?.[`${k}Subject`] || e?.[`${k}Body`]) && "text-rose-700")}
            >
              {DECISION_EMAIL_LABELS[k]}
            </button>
          ))}
        </div>
        <div className={cx("grid gap-4 lg:grid-cols-2", !enabled && "opacity-50")}>
          <div className="space-y-4">
            {/* All three templates are always in the form; only the selected one is visible. */}
            {DECISION_EMAIL_KINDS.map((k) => (
              <div key={k} hidden={tab !== k} className="space-y-4">
                <Field label="Subject" htmlFor={`${k}Subject`} error={e?.[`${k}Subject`]}>
                  <input id={`${k}Subject`} name={`${k}Subject`} value={values[k].subject} onChange={(ev) => set(k, "subject", ev.target.value)} disabled={!enabled} className="control" />
                </Field>
                <Field label="Message" htmlFor={`${k}Body`} error={e?.[`${k}Body`]}>
                  <textarea id={`${k}Body`} name={`${k}Body`} rows={14} value={values[k].body} onChange={(ev) => set(k, "body", ev.target.value)} disabled={!enabled} className="control font-mono text-xs" />
                </Field>
                <button type="button" disabled={!enabled} onClick={() => setValues((prev) => ({ ...prev, [k]: { ...DEFAULT_DECISION_EMAILS[k] } }))} className="text-xs text-ink-soft underline">
                  Reset to the default text
                </button>
              </div>
            ))}
            <div className="text-xs text-ink-soft">
              <p className="mb-1 font-medium text-ink">Placeholders</p>
              <ul className="space-y-0.5">
                {Object.entries(DECISION_PLACEHOLDERS).map(([k, label]) => (
                  <li key={k}><code className="rounded bg-neutral-100 px-1">{`{${k}}`}</code> {label}</li>
                ))}
              </ul>
            </div>
          </div>
          <div>
            <p className="mb-1 text-sm font-medium">Preview</p>
            <div className="rounded-lg border border-line bg-neutral-50 p-4 text-sm">
              <p className="mb-3 border-b border-line pb-2 font-medium">{preview.subject}</p>
              <div className="whitespace-pre-wrap">
                {preview.text.split(`${buttonText}: #`).flatMap((part, i) => (i === 0 ? [part] : [
                  <span key={`b${i}`} className="my-1 inline-block rounded-md bg-ink px-3 py-1.5 text-xs font-semibold text-paper">{buttonText}</span>,
                  part,
                ]))}
              </div>
            </div>
          </div>
        </div>
        {/* Disabled inputs aren't submitted; keep the texts when emails are switched off. */}
        {!enabled && DECISION_EMAIL_KINDS.flatMap((k) => [
          <input key={`${k}s`} type="hidden" name={`${k}Subject`} value={values[k].subject} />,
          <input key={`${k}b`} type="hidden" name={`${k}Body`} value={values[k].body} />,
        ])}
        <FormMessage state={state} />
        <SubmitButton pending={pending}>Save decision emails</SubmitButton>
      </form>
    </Card>
  );
}
