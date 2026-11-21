"use client";

import { useState } from "react";
import { FormMessage, SubmitButton, useFormAction } from "@/components/form-controls";
import { buttonClass, Field } from "@/components/ui";
import { acceptSpeakerInvitation, declineSpeakerInvitation } from "@/lib/actions/speaker-invitations";

export function InvitationResponse({ invitationId, talks, defaultTalkId }: { invitationId: string; talks: { id: string; title: string }[]; defaultTalkId?: string }) {
  const [mode, setMode] = useState<"idle" | "accept" | "decline">("idle");
  const [acceptState, onAccept, accepting] = useFormAction(acceptSpeakerInvitation.bind(null, invitationId), undefined);
  const [declineState, onDecline, declining] = useFormAction(declineSpeakerInvitation.bind(null, invitationId), undefined);

  if (declineState?.ok) return <FormMessage state={declineState} />;
  if (mode === "idle") {
    return (
      <div className="flex gap-2">
        <button type="button" onClick={() => setMode("accept")} className={buttonClass("accent")}>Accept</button>
        <button type="button" onClick={() => setMode("decline")} className={buttonClass("secondary")}>Decline</button>
      </div>
    );
  }
  if (mode === "accept") {
    return (
      <form onSubmit={onAccept} className="space-y-3">
        <Field label="Which session will you give?" htmlFor={`talk-${invitationId}`} error={acceptState?.errors?.talkId}>
          <select id={`talk-${invitationId}`} name="talkId" defaultValue={defaultTalkId ?? talks[0]?.id} className="control">
            {talks.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
          </select>
        </Field>
        <Field label="Note to the organizers (optional)" htmlFor={`note-${invitationId}`}>
          <textarea id={`note-${invitationId}`} name="note" rows={2} className="control" placeholder="Travel needs, dates that work…" />
        </Field>
        <div className="flex items-center gap-2">
          <SubmitButton pending={accepting} pendingLabel="Accepting…">Accept and add to programme</SubmitButton>
          <button type="button" onClick={() => setMode("idle")} className={buttonClass("ghost")}>Cancel</button>
        </div>
        <FormMessage state={acceptState} />
      </form>
    );
  }
  return (
    <form onSubmit={onDecline} className="space-y-3">
      <Field label="Let them know why (optional)" htmlFor={`decline-${invitationId}`}>
        <textarea id={`decline-${invitationId}`} name="note" rows={2} className="control" placeholder="e.g. Already booked that week, maybe next year!" />
      </Field>
      <div className="flex items-center gap-2">
        <SubmitButton pending={declining} variant="secondary" pendingLabel="Declining…">Decline invitation</SubmitButton>
        <button type="button" onClick={() => setMode("idle")} className={buttonClass("ghost")}>Cancel</button>
      </div>
      <FormMessage state={declineState} />
    </form>
  );
}
