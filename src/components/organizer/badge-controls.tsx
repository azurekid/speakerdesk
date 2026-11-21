"use client";

import { useState } from "react";
import { BadgeMedal } from "@/components/badge-medal";
import { FormMessage, SubmitButton, useFormAction } from "@/components/form-controls";
import { cx, Field } from "@/components/ui";
import { awardBadge, createEventBadge } from "@/lib/actions/badges";
import { BADGE_COLORS, BADGE_ICONS, type BadgeColor, type BadgeIcon } from "@/lib/badges";

type BadgeOption = { id: string; name: string; description: string; icon: string; color: string; platform: boolean };
type RecipientOption = { id: string; name: string; group: string; detail: string };

export function AwardBadgeForm({ eventId, badges, recipients, eventName, date }: { eventId: string; badges: BadgeOption[]; recipients: RecipientOption[]; eventName: string; date: string | null }) {
  const [state, onSubmit, pending] = useFormAction(awardBadge.bind(null, eventId), undefined);
  const [badgeId, setBadgeId] = useState(badges[0]?.id ?? "");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const badge = badges.find((b) => b.id === badgeId);
  const groups = [...new Set(recipients.map((r) => r.group))];
  const e = state?.errors;

  if (!recipients.length) {
    return <p className="text-sm text-ink-soft">Badges go to accepted speakers (once you publish decisions) and your team. Nobody is eligible yet.</p>;
  }
  const toggle = (id: string) => setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <Field label="Badge" htmlFor="badgeId" error={e?.badgeId}>
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          {badge && <BadgeMedal icon={badge.icon} color={badge.color} size="lg" label={badge.name} eventName={eventName} date={date} />}
          <select id="badgeId" name="badgeId" value={badgeId} onChange={(ev) => setBadgeId(ev.target.value)} className="control">
            <optgroup label="SpeakerDesk badges">
              {badges.filter((b) => b.platform).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </optgroup>
            {badges.some((b) => !b.platform) && (
              <optgroup label="Your event's badges">
                {badges.filter((b) => !b.platform).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </optgroup>
            )}
          </select>
        </div>
        {badge?.description && <p className="mt-1 text-xs text-ink-soft">{badge.description}</p>}
      </Field>

      <fieldset>
        <legend className="mb-2 flex w-full items-center justify-between text-sm font-medium text-ink">
          <span>Who gets it?</span>
          <button type="button" className="text-xs font-normal text-ink-soft underline" onClick={() => setPicked(picked.size === recipients.length ? new Set() : new Set(recipients.map((r) => r.id)))}>
            {picked.size === recipients.length ? "Select none" : "Select everyone"}
          </button>
        </legend>
        {e?.recipientIds && <p className="mb-2 text-xs text-rose-700">{e.recipientIds[0]}</p>}
        <div className="space-y-4">
          {groups.map((g) => (
            <div key={g}>
              <p className="mb-1 text-xs font-medium text-ink-soft">{g}</p>
              <div className="grid gap-1 sm:grid-cols-2">
                {recipients.filter((r) => r.group === g).map((r) => (
                  <label key={r.id} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border border-line px-3 py-2 text-sm has-checked:border-ink has-checked:bg-neutral-50">
                    <input type="checkbox" name="recipientIds" value={r.id} checked={picked.has(r.id)} onChange={() => toggle(r.id)} className="mt-0.5 accent-ink" />
                    <span className="min-w-0">
                      <span className="block font-medium">{r.name}</span>
                      <span className="block truncate text-xs text-ink-soft">{r.detail}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </fieldset>

      <Field label="Message (optional)" htmlFor="message" error={e?.message} hint="Shown with the badge, e.g. what they did that made the difference.">
        <textarea id="message" name="message" rows={2} maxLength={500} className="control" placeholder="Thank you for the standing-room-only workshop!" />
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pending={pending} pendingLabel="Awarding…">{picked.size ? `Award to ${picked.size} ${picked.size === 1 ? "person" : "people"}` : "Award badge"}</SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

export function CreateBadgeForm({ eventId, eventName, date }: { eventId: string; eventName: string; date: string | null }) {
  const [state, onSubmit, pending] = useFormAction(createEventBadge.bind(null, eventId), undefined);
  const [icon, setIcon] = useState<BadgeIcon>("award");
  const [color, setColor] = useState<BadgeColor>("brand");
  const [name, setName] = useState("");
  const e = state?.errors;
  return (
    <form onSubmit={onSubmit} className="space-y-4" key={state?.ok ? state.message : "form"}>
      <div className="flex flex-col items-center gap-1">
        <BadgeMedal icon={icon} color={color} size="lg" label={name || "Your badge"} eventName={eventName} date={date} className="size-44" />
        <p className="text-xs text-ink-soft">Preview</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor="badge-name" error={e?.name}>
          <input id="badge-name" name="name" maxLength={60} required value={name} onChange={(ev) => setName(ev.target.value)} className="control" placeholder="e.g. Best demo 2027" />
        </Field>
        <Field label="Description" htmlFor="badge-description" error={e?.description}>
          <input id="badge-description" name="description" maxLength={300} className="control" placeholder="What it recognises" />
        </Field>
      </div>
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-ink">Icon</legend>
        <input type="hidden" name="icon" value={icon} />
        <div className="flex flex-wrap gap-2">
          {BADGE_ICONS.map((i) => (
            <button key={i} type="button" onClick={() => setIcon(i)} aria-pressed={icon === i} aria-label={i} className={cx("rounded-t-xl rounded-b-full p-0.5 ring-offset-2", icon === i && "ring-2 ring-ink")}>
              <BadgeMedal icon={i} color={color} size="sm" />
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-ink">Theme</legend>
        <input type="hidden" name="color" value={color} />
        <div className="flex flex-wrap gap-3">
          {(Object.keys(BADGE_COLORS) as BadgeColor[]).map((c) => (
            <button key={c} type="button" onClick={() => setColor(c)} aria-pressed={color === c} className="flex flex-col items-center gap-1 text-[11px] text-ink-soft">
              <span className={cx("rounded-t-xl rounded-b-full ring-offset-2", color === c && "ring-2 ring-ink")}><BadgeMedal icon={icon} color={c} size="md" /></span>
              {BADGE_COLORS[c].label}
            </button>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pending={pending} pendingLabel="Creating…">Create badge</SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
