"use client";

import Link from "next/link";
import { CountedTextarea, FormMessage, ListInput, SubmitButton, TagInput, useFormAction } from "@/components/form-controls";
import { buttonClass, Card, Field } from "@/components/ui";
import type { ActionState } from "@/lib/validation";
import {
  ABSTRACT_LIMITS, DURATIONS, FORMAT_LABELS, LEVEL_LABELS, TALK_FORMATS, TALK_LEVELS, type TalkFormat, type TalkLevel,
} from "@/lib/domain";

export type TalkFormValues = {
  title: string;
  subtitle: string;
  abstractShort: string;
  abstractLong: string;
  outline: string;
  takeaways: string[];
  format: TalkFormat;
  durationMinutes: number;
  level: TalkLevel;
  primaryTrack: string;
  tags: string[];
  language: string;
  equipmentNeeds: string;
  organizerNotes: string;
  slidesUrl: string;
  videoUrl: string;
  coSpeakers: string;
};

export const EMPTY_TALK: TalkFormValues = {
  title: "", subtitle: "", abstractShort: "", abstractLong: "", outline: "", takeaways: [],
  format: "SESSION", durationMinutes: 45, level: "INTERMEDIATE", primaryTrack: "", tags: [], language: "en",
  equipmentNeeds: "", organizerNotes: "", slidesUrl: "", videoUrl: "", coSpeakers: "",
};

export function TalkForm({
  talk, action, tagSuggestions, cancelHref,
}: {
  talk: TalkFormValues;
  action: (prev: ActionState, form: FormData) => Promise<ActionState>;
  tagSuggestions: string[];
  cancelHref: string;
}) {
  const [state, onSubmit, pending] = useFormAction(action, undefined);
  const e = state?.errors;
  const durations = DURATIONS.includes(talk.durationMinutes as never) ? DURATIONS : [...DURATIONS, talk.durationMinutes].sort((a, b) => a - b);

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <Card title="Title">
        <div className="space-y-4">
          <Field label="Title" htmlFor="title" error={e?.title}>
            <input id="title" name="title" defaultValue={talk.title} required maxLength={300} className="control text-base font-medium" />
          </Field>
          <Field label="Subtitle" htmlFor="subtitle" error={e?.subtitle}>
            <input id="subtitle" name="subtitle" defaultValue={talk.subtitle} maxLength={300} className="control" />
          </Field>
        </div>
      </Card>

      <Card title="Abstracts" description="Keep a short pitch and a master abstract; character counts show typical CfP limits.">
        <div className="space-y-4">
          <CountedTextarea name="abstractShort" label="Short pitch" limit={ABSTRACT_LIMITS.short} defaultValue={talk.abstractShort} rows={4} error={e?.abstractShort} hint="For lightning-talk CfPs, program listings and social posts." />
          <CountedTextarea name="abstractLong" label="Master abstract" limit={ABSTRACT_LIMITS.long} defaultValue={talk.abstractLong} rows={10} error={e?.abstractLong} />
        </div>
      </Card>

      <Card title="Key takeaways" description="3–5 bullet points. run.events and Sessionize both ask for these.">
        <ListInput name="takeaways" defaultValue={talk.takeaways} placeholder="Attendees will learn how to…" />
      </Card>

      <Card title="Details">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Format" htmlFor="format" error={e?.format}>
            <select id="format" name="format" defaultValue={talk.format} className="control">
              {TALK_FORMATS.map((f) => <option key={f} value={f}>{FORMAT_LABELS[f]}</option>)}
            </select>
          </Field>
          <Field label="Duration" htmlFor="durationMinutes" error={e?.durationMinutes}>
            <select id="durationMinutes" name="durationMinutes" defaultValue={talk.durationMinutes} className="control">
              {durations.map((d) => <option key={d} value={d}>{d >= 60 && d % 60 === 0 ? `${d / 60} h` : `${d} min`}</option>)}
            </select>
          </Field>
          <Field label="Level" htmlFor="level" error={e?.level}>
            <select id="level" name="level" defaultValue={talk.level} className="control">
              {TALK_LEVELS.map((l) => <option key={l} value={l}>{LEVEL_LABELS[l]}</option>)}
            </select>
          </Field>
          <Field label="Primary track / category" htmlFor="primaryTrack" error={e?.primaryTrack} className="sm:col-span-2">
            <input id="primaryTrack" name="primaryTrack" defaultValue={talk.primaryTrack} placeholder="e.g. Cloud & Infrastructure" className="control" />
          </Field>
          <Field label="Language" htmlFor="language" error={e?.language}>
            <input id="language" name="language" defaultValue={talk.language} placeholder="en" className="control" />
          </Field>
          <Field label="Tags" error={e?.tags} className="sm:col-span-3" hint="Press Enter or comma to add.">
            <TagInput name="tags" defaultValue={talk.tags} suggestions={tagSuggestions} />
          </Field>
          <Field label="Co-speakers" htmlFor="coSpeakers" error={e?.coSpeakers} className="sm:col-span-3">
            <input id="coSpeakers" name="coSpeakers" defaultValue={talk.coSpeakers} placeholder="Names, comma separated" className="control" />
          </Field>
        </div>
      </Card>

      <Card title="Outline & prep" description="Internal notes — not copied into CfPs unless you choose to.">
        <CountedTextarea name="outline" label="Outline" defaultValue={talk.outline} rows={8} error={e?.outline} hint="Section-by-section flow, demo plan, timings." />
      </Card>

      <Card title="For organizers">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Slides URL" htmlFor="slidesUrl" error={e?.slidesUrl}>
            <input id="slidesUrl" name="slidesUrl" type="url" defaultValue={talk.slidesUrl} placeholder="https://" className="control" />
          </Field>
          <Field label="Best recording URL" htmlFor="videoUrl" error={e?.videoUrl} hint="Social proof for CfP committees.">
            <input id="videoUrl" name="videoUrl" type="url" defaultValue={talk.videoUrl} placeholder="https://" className="control" />
          </Field>
          <Field label="Equipment needs" htmlFor="equipmentNeeds" error={e?.equipmentNeeds} className="sm:col-span-2">
            <textarea id="equipmentNeeds" name="equipmentNeeds" rows={2} defaultValue={talk.equipmentNeeds} placeholder="HDMI/USB-C, wired internet for live demo, lapel mic…" className="control" />
          </Field>
          <Field label="Notes for organizers" htmlFor="organizerNotes" error={e?.organizerNotes} className="sm:col-span-2">
            <textarea id="organizerNotes" name="organizerNotes" rows={3} defaultValue={talk.organizerNotes} placeholder="Delivery history, audience fit, why now…" className="control" />
          </Field>
        </div>
      </Card>

      <div className="sticky bottom-0 -mx-4 flex items-center justify-end gap-3 border-t border-line bg-neutral-50/90 px-4 py-3 backdrop-blur sm:-mx-8 sm:px-8">
        <div className="flex-1"><FormMessage state={state} /></div>
        <Link href={cancelHref} className={buttonClass("ghost")}>Cancel</Link>
        <SubmitButton pending={pending}>Save session</SubmitButton>
      </div>
    </form>
  );
}
