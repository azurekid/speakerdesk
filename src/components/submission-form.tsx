"use client";

import Link from "next/link";
import { useTransition } from "react";
import { FormMessage, SubmitButton, useFormAction } from "@/components/form-controls";
import { buttonClass, Card, cx, Field } from "@/components/ui";
import { setSubmissionStatus } from "@/lib/actions/submissions";
import {
  PLATFORM_LABELS, PLATFORMS, type Platform, STATUS_LABELS, STATUS_STYLES, SUBMISSION_STATUSES, type SubmissionStatus,
} from "@/lib/domain";
import type { ActionState } from "@/lib/validation";

export type SubmissionFormValues = {
  talkId: string;
  eventName: string;
  eventUrl: string;
  cfpUrl: string;
  platform: Platform;
  location: string;
  status: SubmissionStatus;
  cfpDeadline: string;
  eventStart: string;
  eventEnd: string;
  submittedAt: string;
  recordingUrl: string;
  notes: string;
  mvpTechnologyArea: string;
  targetAudience: string;
  microsoftEvent: boolean;
  inPersonAttendees: string;
  liveStreamViews: string;
  onDemandViews: string;
};

export function SubmissionForm({
  values, talks, action, cancelHref,
}: {
  values: SubmissionFormValues;
  talks: { id: string; title: string }[];
  action: (prev: ActionState, form: FormData) => Promise<ActionState>;
  cancelHref: string;
}) {
  const [state, onSubmit, pending] = useFormAction(action, undefined);
  const e = state?.errors;
  const input = (name: Exclude<keyof SubmissionFormValues, "microsoftEvent">, label: string, opts: { type?: string; placeholder?: string; className?: string; hint?: string } = {}) => (
    <Field label={label} htmlFor={name} error={e?.[name]} className={opts.className} hint={opts.hint}>
      <input id={name} name={name} type={opts.type ?? "text"} defaultValue={values[name]} placeholder={opts.placeholder} aria-invalid={e?.[name] ? true : undefined} className="control" />
    </Field>
  );

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <Card title="Event">
        <div className="grid gap-4 sm:grid-cols-2">
          {input("eventName", "Event name", { placeholder: "e.g. Cloud Native Days 2027", className: "sm:col-span-2" })}
          <Field label="Platform" htmlFor="platform" error={e?.platform}>
            <select id="platform" name="platform" defaultValue={values.platform} className="control">
              {PLATFORMS.map((p) => <option key={p} value={p}>{PLATFORM_LABELS[p]}</option>)}
            </select>
          </Field>
          {input("location", "Location", { placeholder: "City, country or Online" })}
          {input("eventUrl", "Event website", { type: "url", placeholder: "https://" })}
          {input("cfpUrl", "CfP link", { type: "url", placeholder: "https://sessionize.com/…" })}
          {input("eventStart", "Event starts", { type: "date" })}
          {input("eventEnd", "Event ends", { type: "date" })}
        </div>
      </Card>

      <Card title="Submission">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Session" htmlFor="talkId" error={e?.talkId} className="sm:col-span-2">
            <select id="talkId" name="talkId" defaultValue={values.talkId} className="control">
              <option value="">Not linked to a session</option>
              {talks.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
          </Field>
          <Field label="Status" htmlFor="status" error={e?.status}>
            <select id="status" name="status" defaultValue={values.status} className="control">
              {SUBMISSION_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
            </select>
          </Field>
          {input("cfpDeadline", "CfP deadline", { type: "date" })}
          {input("submittedAt", "Submitted on", { type: "date" })}
          {input("recordingUrl", "Recording URL", { type: "url", placeholder: "https://youtube.com/…", hint: "After the event. Builds your delivery history." })}
          <div data-shot="mvp-details" className="sm:col-span-2">
          <Card title="Delivery details" description="For reporting this talk to the MVP portal or similar. Fill in after the event: the numbers are usually known then.">
            <div className="grid gap-4 sm:grid-cols-2">
              {input("mvpTechnologyArea", "Technology area", { placeholder: "e.g. Azure, Microsoft 365, Security", hint: "Use the name the portal shows for this area." })}
              {input("targetAudience", "Target audience", { placeholder: "e.g. Developers, IT pros, Students", hint: "Who the talk was for." })}
              {input("inPersonAttendees", "In-person attendees", { type: "number", placeholder: "0" })}
              {input("liveStreamViews", "Live stream views", { type: "number", placeholder: "0" })}
              {input("onDemandViews", "On-demand views", { type: "number", placeholder: "0", hint: "Recording views, if any." })}
              <label className="flex items-start gap-3 self-end text-sm sm:col-span-2">
                <input type="checkbox" name="microsoftEvent" defaultChecked={values.microsoftEvent} className="mt-0.5 accent-ink" />
                <span>This was a Microsoft-run event (not a third-party event)</span>
              </label>
            </div>
          </Card>
          </div>
          <Field label="Notes" htmlFor="notes" error={e?.notes} className="sm:col-span-2">
            <textarea id="notes" name="notes" rows={4} defaultValue={values.notes} className="control" placeholder="Custom CfP answers, organizer contacts, travel arrangements…" />
          </Field>
        </div>
      </Card>

      <div className="flex items-center justify-end gap-3">
        <div className="flex-1"><FormMessage state={state} /></div>
        <Link href={cancelHref} className={buttonClass("ghost")}>Cancel</Link>
        <SubmitButton pending={pending}>Save submission</SubmitButton>
      </div>
    </form>
  );
}

/** Inline status dropdown for the tracker table. */
export function StatusSelect({ id, status }: { id: string; status: SubmissionStatus }) {
  const [pending, startTransition] = useTransition();
  return (
    <select
      aria-label="Status"
      defaultValue={status}
      disabled={pending}
      onChange={(ev) => {
        const next = ev.target.value as SubmissionStatus;
        startTransition(() => setSubmissionStatus(id, next));
      }}
      className={cx("rounded-md border-0 py-1.5 pl-2.5 pr-8 text-base font-medium ring-1 ring-inset sm:py-1 sm:pl-2 sm:pr-7 sm:text-xs", STATUS_STYLES[status], pending && "opacity-60")}
    >
      {SUBMISSION_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
    </select>
  );
}
