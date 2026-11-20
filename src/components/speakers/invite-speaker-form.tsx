"use client";

import { FormMessage, SubmitButton, useFormAction } from "@/components/form-controls";
import { Field } from "@/components/ui";
import { inviteSpeaker } from "@/lib/actions/speaker-invitations";

export function InviteSpeakerForm({ speakerId, speakerName, events, talks, defaultTalkId }: {
  speakerId: string;
  speakerName: string;
  events: { id: string; name: string }[];
  talks: { id: string; title: string }[];
  defaultTalkId?: string;
}) {
  const [state, onSubmit, pending] = useFormAction(inviteSpeaker.bind(null, speakerId), undefined);
  const e = state?.errors;
  if (state?.ok) return <FormMessage state={state} />;
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="Event" htmlFor="eventId" error={e?.eventId}>
        <select id="eventId" name="eventId" className="control" defaultValue={events[0]?.id}>
          {events.map((ev) => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
        </select>
      </Field>
      <Field label="Talk" htmlFor="talkId" error={e?.talkId} hint="Optional — or let them pick.">
        <select id="talkId" name="talkId" className="control" defaultValue={defaultTalkId ?? ""}>
          <option value="">Let {speakerName.split(" ")[0]} choose</option>
          {talks.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
        </select>
      </Field>
      <Field label="Personal note" htmlFor="message" error={e?.message}>
        <textarea id="message" name="message" rows={4} className="control" placeholder="Why you'd love them at your event, audience, travel support…" />
      </Field>
      <SubmitButton pending={pending} pendingLabel="Sending…">Send invitation</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
