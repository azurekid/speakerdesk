"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { FormMessage, SubmitButton, TagInput, useFormAction } from "@/components/form-controls";
import { VenuePicker } from "@/components/organizer/venue-picker";
import { buttonClass, Card, cx, Field } from "@/components/ui";
import { CONFIRMATION_PLACEHOLDERS, DEFAULT_CONFIRMATION_BODY, DEFAULT_CONFIRMATION_SUBJECT, renderConfirmation } from "@/lib/confirmation-email";
import { COVER_IMAGES, EVENT_FORMAT_LABELS, EVENT_FORMATS, type EventFormat, FORMAT_LABELS, TALK_FORMATS, type TalkFormat } from "@/lib/domain";
import type { ActionState } from "@/lib/validation";

export type EventFormValues = {
  name: string; tagline: string; description: string; format: EventFormat; onlinePlatform: string; location: string; venue: string; address: string; latitude: number | null; longitude: number | null;
  website: string; coverImage: string;
  startDate: string; endDate: string; cfpOpensAt: string; cfpClosesAt: string; cfpGuidelines: string;
  tracks: string[]; formats: TalkFormat[]; titleLimit: string; abstractLimit: string; maxProposalsPerSpeaker: number; blindReview: boolean;
  confirmationEmailEnabled: boolean; confirmationEmailSubject: string; confirmationEmailBody: string;
};

export const EMPTY_EVENT: EventFormValues = {
  name: "", tagline: "", description: "", format: "IN_PERSON", onlinePlatform: "", location: "", venue: "", address: "", latitude: null, longitude: null, website: "", coverImage: COVER_IMAGES[0].src,
  startDate: "", endDate: "", cfpOpensAt: "", cfpClosesAt: "", cfpGuidelines: "",
  tracks: [], formats: ["SESSION", "WORKSHOP", "LIGHTNING_TALK"], titleLimit: "", abstractLimit: "1000", maxProposalsPerSpeaker: 3, blindReview: false,
  confirmationEmailEnabled: true, confirmationEmailSubject: "", confirmationEmailBody: "",
};

export function EventForm({ values, action, submitLabel, cancelHref }: {
  values: EventFormValues;
  action: (prev: ActionState, form: FormData) => Promise<ActionState>;
  submitLabel: string;
  cancelHref: string;
}) {
  const [state, onSubmit, pending] = useFormAction(action, undefined);
  const e = state?.errors;
  const [cover, setCover] = useState(values.coverImage);
  const [format, setFormat] = useState<EventFormat>(values.format);
  const isCustom = !COVER_IMAGES.some((c) => c.src === cover);
  const input = (name: keyof EventFormValues, label: string, opts: { type?: string; placeholder?: string; className?: string; hint?: string } = {}) => (
    <Field label={label} htmlFor={name} error={e?.[name]} className={opts.className} hint={opts.hint}>
      <input id={name} name={name} type={opts.type ?? "text"} defaultValue={String(values[name] ?? "")} placeholder={opts.placeholder} aria-invalid={e?.[name] ? true : undefined} className="control" />
    </Field>
  );

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <Card title="The event">
        <div className="grid gap-4 sm:grid-cols-2">
          {input("name", "Event name", { placeholder: "e.g. Cloud Native Days Amsterdam 2027", className: "sm:col-span-2" })}
          {input("tagline", "Tagline", { placeholder: "One line that sells it", className: "sm:col-span-2" })}
          <Field label="Description" htmlFor="description" error={e?.description} className="sm:col-span-2">
            <textarea id="description" name="description" rows={5} defaultValue={values.description} className="control" placeholder="Audience, size, what makes it special…" />
          </Field>
          {input("startDate", "Starts", { type: "date" })}
          {input("endDate", "Ends", { type: "date" })}
          <fieldset className="sm:col-span-2">
            <legend className="mb-2 text-sm font-medium text-ink">Where does it happen?</legend>
            <div className="flex flex-wrap gap-2">
              {EVENT_FORMATS.map((f) => (
                <label key={f} className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-line bg-surface px-3 py-1.5 text-sm has-checked:border-ink has-checked:bg-neutral-50">
                  <input type="radio" name="format" value={f} checked={format === f} onChange={() => setFormat(f)} className="accent-ink" />
                  {EVENT_FORMAT_LABELS[f]}
                </label>
              ))}
            </div>
          </fieldset>
          {format !== "ONLINE" && (
            <VenuePicker initial={{ venue: values.venue, address: values.address, location: values.location === "Online" ? "" : values.location, latitude: values.latitude, longitude: values.longitude }} errors={e} />
          )}
          {format !== "IN_PERSON" &&
            input("onlinePlatform", "Online platform", { placeholder: "e.g. YouTube Live, Zoom, Hopin", className: "sm:col-span-2", hint: "Shown on the public page. Don't put private join links here." })}
          {input("website", "Website", { type: "url", placeholder: "https://", className: "sm:col-span-2" })}
        </div>
      </Card>

      <Card title="Cover photo" description="Shown on your public event page and in the list of open calls.">
        <input type="hidden" name="coverImage" value={cover} />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {COVER_IMAGES.map((c) => (
            <button
              key={c.src}
              type="button"
              onClick={() => setCover(c.src)}
              aria-pressed={cover === c.src}
              className={cx("relative aspect-[4/3] overflow-hidden rounded-md ring-offset-2 transition", cover === c.src ? "ring-2 ring-brand-600" : "opacity-80 hover:opacity-100")}
            >
              <Image src={c.src} alt={c.label} fill sizes="200px" className="object-cover" />
              <span className="absolute inset-x-0 bottom-0 bg-black/55 px-2 py-1 text-left text-[11px] text-paper">{c.label}</span>
            </button>
          ))}
        </div>
        <Field label="…or use your own image URL" htmlFor="customCover" error={e?.coverImage} className="mt-4">
          <input id="customCover" type="url" placeholder="https://your-cdn.example/cover.jpg" defaultValue={isCustom ? cover : ""} onChange={(ev) => ev.target.value && setCover(ev.target.value)} className="control" />
        </Field>
      </Card>

      <Card title="Call for papers" description="Speakers see these rules on the event page, and SpeakerDesk enforces them when they submit.">
        <div className="grid gap-4 sm:grid-cols-2">
          {input("cfpOpensAt", "Opens", { type: "date", hint: "Leave empty to open as soon as you publish." })}
          {input("cfpClosesAt", "Closes", { type: "date", hint: "Open through the end of this day (UTC)." })}
          <Field label="What you're looking for" htmlFor="cfpGuidelines" error={e?.cfpGuidelines} className="sm:col-span-2">
            <textarea id="cfpGuidelines" name="cfpGuidelines" rows={5} defaultValue={values.cfpGuidelines} className="control" placeholder="Topics, audience level, first-time speakers welcome, travel support…" />
          </Field>
          <Field label="Tracks" error={e?.tracks} className="sm:col-span-2" hint="Speakers must pick one. Leave empty for no tracks.">
            <TagInput name="tracks" defaultValue={values.tracks} lowercase={false} prefix="" placeholder="e.g. Platform Engineering, then Enter" />
          </Field>
          <fieldset className="sm:col-span-2">
            <legend className="mb-2 text-sm font-medium text-ink">Accepted formats</legend>
            <div className="flex flex-wrap gap-2">
              {TALK_FORMATS.map((f) => (
                <label key={f} className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-line bg-surface px-3 py-1.5 text-sm has-checked:border-ink has-checked:bg-neutral-50">
                  <input type="checkbox" name="formats" value={f} defaultChecked={values.formats.includes(f)} className="accent-ink" />
                  {FORMAT_LABELS[f]}
                </label>
              ))}
            </div>
          </fieldset>
          {input("titleLimit", "Title limit (characters)", { type: "number", placeholder: "No limit" })}
          {input("abstractLimit", "Abstract limit (characters)", { type: "number", placeholder: "No limit" })}
          {input("maxProposalsPerSpeaker", "Proposals per speaker", { type: "number" })}
          <label className="flex items-start gap-3 self-end rounded-md border border-line bg-surface px-3 py-2.5 text-sm">
            <input type="checkbox" name="blindReview" defaultChecked={values.blindReview} className="mt-0.5 accent-ink" />
            <span><span className="font-medium">Anonymous review</span><br /><span className="text-xs text-ink-soft">Reviewers don&apos;t see who submitted.</span></span>
          </label>
        </div>
      </Card>

      <ConfirmationEmail values={values} errors={e} />

      <div className="flex items-center justify-end gap-3">
        <div className="flex-1"><FormMessage state={state} /></div>
        <Link href={cancelHref} className={buttonClass("ghost")}>Cancel</Link>
        <SubmitButton pending={pending}>{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}

/** The email a speaker gets right after submitting. Placeholders are filled when it's sent. */
function ConfirmationEmail({ values, errors }: { values: EventFormValues; errors?: Record<string, string[] | undefined> }) {
  const [enabled, setEnabled] = useState(values.confirmationEmailEnabled);
  const [subject, setSubject] = useState(values.confirmationEmailSubject || DEFAULT_CONFIRMATION_SUBJECT);
  const [body, setBody] = useState(values.confirmationEmailBody || DEFAULT_CONFIRMATION_BODY);
  const preview = renderConfirmation(
    { subject, body },
    { SPEAKER_NAME: "Alex Example", SESSION_NAME: "Scaling Kubernetes for Fun", EVENT_NAME: values.name || "Your event", EVENT_URL: "https://…/events/your-event", DASHBOARD_URL: "#" },
  );

  return (
    <Card title="Submission confirmation email" description="Sent to the speaker as soon as they submit a proposal.">
      <label className="mb-4 flex items-start gap-3 text-sm">
        <input type="checkbox" name="confirmationEmailEnabled" checked={enabled} onChange={(ev) => setEnabled(ev.target.checked)} className="mt-0.5 accent-ink" />
        <span className="font-medium">Send a confirmation email</span>
      </label>
      <div className={cx("grid gap-4 lg:grid-cols-2", !enabled && "opacity-50")}>
        <div className="space-y-4">
          <Field label="Subject" htmlFor="confirmationEmailSubject" error={errors?.confirmationEmailSubject}>
            <input id="confirmationEmailSubject" name="confirmationEmailSubject" value={subject} onChange={(ev) => setSubject(ev.target.value)} disabled={!enabled} className="control" />
          </Field>
          <Field label="Message" htmlFor="confirmationEmailBody" error={errors?.confirmationEmailBody}>
            <textarea id="confirmationEmailBody" name="confirmationEmailBody" rows={14} value={body} onChange={(ev) => setBody(ev.target.value)} disabled={!enabled} className="control font-mono text-xs" />
          </Field>
          <div className="text-xs text-ink-soft">
            <p className="mb-1 font-medium text-ink">Placeholders</p>
            <ul className="space-y-0.5">
              {Object.entries(CONFIRMATION_PLACEHOLDERS).map(([k, label]) => (
                <li key={k}><code className="rounded bg-neutral-100 px-1">{`{${k}}`}</code> {label}</li>
              ))}
            </ul>
            <button type="button" disabled={!enabled} onClick={() => { setSubject(DEFAULT_CONFIRMATION_SUBJECT); setBody(DEFAULT_CONFIRMATION_BODY); }} className="mt-2 underline">Reset to the default text</button>
          </div>
        </div>
        <div>
          <p className="mb-1 text-sm font-medium">Preview</p>
          <div className="rounded-lg border border-line bg-neutral-50 p-4 text-sm">
            <p className="mb-3 border-b border-line pb-2 font-medium">{preview.subject}</p>
            <div className="whitespace-pre-wrap">
              {preview.text.split(/(Open your speaker dashboard: #)/).map((part, i) =>
                part === "Open your speaker dashboard: #" ? <span key={i} className="my-1 inline-block rounded-md bg-ink px-3 py-1.5 text-xs font-semibold text-paper">Open speaker dashboard</span> : part,
              )}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
