"use client";

import Link from "next/link";
import { useState } from "react";
import { CountedTextarea, FormMessage, ListInput, SubmitButton, useFormAction } from "@/components/form-controls";
import { RequirementPicker } from "@/components/requirement-picker";
import { buttonClass, Card, Field } from "@/components/ui";
import { PRESENTATION_REQUIREMENTS } from "@/lib/requirements";
import { DURATIONS, FORMAT_LABELS, LEVEL_LABELS, TALK_FORMATS, TALK_LEVELS, type TalkFormat, type TalkLevel } from "@/lib/domain";
import type { ActionState } from "@/lib/validation";

export type LibraryTalk = {
  id: string;
  title: string;
  abstractShort: string;
  abstractLong: string;
  takeaways: string[];
  format: TalkFormat;
  durationMinutes: number;
  level: TalkLevel;
  primaryTrack: string;
  equipmentNeeds: string;
};

type Rules = { titleLimit: number | null; abstractLimit: number | null; formats: TalkFormat[]; tracks: string[] };

/** Picks the abstract that fits this CfP: the master abstract if it fits, else the short pitch. */
function bestAbstract(t: LibraryTalk, limit: number | null) {
  if (!t.abstractLong) return t.abstractShort;
  if (limit && t.abstractLong.length > limit && t.abstractShort) return t.abstractShort;
  return t.abstractLong;
}

export function ProposalForm({ talks, rules, action, cancelHref, initialTalkId }: {
  talks: LibraryTalk[];
  rules: Rules;
  action: (prev: ActionState, form: FormData) => Promise<ActionState>;
  cancelHref: string;
  initialTalkId?: string;
}) {
  const [talkId, setTalkId] = useState(initialTalkId ?? talks[0]?.id ?? "");
  const [state, onSubmit, pending] = useFormAction(action, undefined);
  const e = state?.errors;
  const talk = talks.find((t) => t.id === talkId);
  const formats = rules.formats.length ? rules.formats : TALK_FORMATS;
  const defaultFormat = talk && formats.includes(talk.format) ? talk.format : formats[0];
  const defaultTrack = talk && rules.tracks.includes(talk.primaryTrack) ? talk.primaryTrack : "";

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <Card title="Start from your library" description="We copy the session in; edit anything below to tailor it for this event. Your library stays unchanged.">
        {talks.length ? (
          <Field label="Session" htmlFor="talkId">
            <select id="talkId" name="talkId" value={talkId} onChange={(ev) => setTalkId(ev.target.value)} className="control">
              {talks.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
              <option value="">Start from scratch</option>
            </select>
          </Field>
        ) : (
          <p className="text-sm text-ink-soft">
            Your library is empty — fill in the proposal directly, or <Link href="/sessions/new" className="font-medium text-ink underline">write a session first</Link>.
            <input type="hidden" name="talkId" value="" />
          </p>
        )}
      </Card>

      {/* Remount the fields when the chosen talk changes so they prefill again. */}
      <div key={talkId} className="space-y-6">
        <Card title="Proposal">
          <div className="space-y-4">
            <CountedTextarea name="title" label="Title" defaultValue={talk?.title ?? ""} limit={rules.titleLimit ?? undefined} rows={1} error={e?.title} required />
            <CountedTextarea
              name="abstract"
              label="Abstract"
              defaultValue={talk ? bestAbstract(talk, rules.abstractLimit) : ""}
              limit={rules.abstractLimit ?? undefined}
              rows={10}
              error={e?.abstract}
              hint={rules.abstractLimit ? "We picked whichever of your abstracts fits this CfP's limit." : undefined}
              required
            />
            <Field label="Key takeaways">
              <ListInput name="takeaways" defaultValue={talk?.takeaways ?? []} placeholder="Attendees will learn how to…" />
            </Field>
          </div>
        </Card>

        <Card title="Details">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Format" htmlFor="format" error={e?.format}>
              <select id="format" name="format" defaultValue={defaultFormat} className="control">
                {formats.map((f) => <option key={f} value={f}>{FORMAT_LABELS[f]}</option>)}
              </select>
            </Field>
            <Field label="Duration" htmlFor="durationMinutes" error={e?.durationMinutes}>
              <select id="durationMinutes" name="durationMinutes" defaultValue={talk?.durationMinutes ?? 45} className="control">
                {[...new Set([...DURATIONS, talk?.durationMinutes ?? 45])].sort((a, b) => a - b).map((d) => <option key={d} value={d}>{d} min</option>)}
              </select>
            </Field>
            <Field label="Level" htmlFor="level" error={e?.level}>
              <select id="level" name="level" defaultValue={talk?.level ?? "INTERMEDIATE"} className="control">
                {TALK_LEVELS.map((l) => <option key={l} value={l}>{LEVEL_LABELS[l]}</option>)}
              </select>
            </Field>
            {rules.tracks.length > 0 ? (
              <Field label="Track" htmlFor="track" error={e?.track}>
                <select id="track" name="track" defaultValue={defaultTrack} required className="control">
                  <option value="" disabled>Choose a track…</option>
                  {rules.tracks.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
            ) : (
              <input type="hidden" name="track" value="" />
            )}
            <Field label="Note to the organizers" htmlFor="notes" error={e?.notes} className="sm:col-span-2" hint="Not shown publicly. Delivery history, why this event.">
              <textarea id="notes" name="notes" rows={3} className="control" />
            </Field>
          </div>
        </Card>

        <Card title="What you need to present" description="Tick everything you need. Organizers use this to plan rooms, AV and accessibility.">
          <RequirementPicker name="requirements" groups={PRESENTATION_REQUIREMENTS} />
          {e?.requirements && <p className="mt-2 text-xs text-rose-700">{e.requirements[0]}</p>}
          <Field label="Anything else?" htmlFor="requirementsNote" error={e?.requirementsNote} className="mt-5" hint={talk?.equipmentNeeds ? "Prefilled from the equipment notes in your session library." : undefined}>
            <textarea id="requirementsNote" name="requirementsNote" rows={2} defaultValue={talk?.equipmentNeeds ?? ""} className="control" placeholder="e.g. I demo on a Raspberry Pi and need an HDMI capture card" />
          </Field>
        </Card>
      </div>

      <div className="flex items-center justify-end gap-3">
        <div className="flex-1"><FormMessage state={state} /></div>
        <Link href={cancelHref} className={buttonClass("ghost")}>Cancel</Link>
        <SubmitButton pending={pending} pendingLabel="Sending…">Send proposal</SubmitButton>
      </div>
    </form>
  );
}
