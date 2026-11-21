"use client";

import { useState } from "react";
import { FormMessage, SubmitButton, useFormAction } from "@/components/form-controls";
import { buttonClass } from "@/components/ui";
import { respondToAcceptance } from "@/lib/actions/proposals";

/** Accepted speaker: confirm the session, or tell the organizers you can't make it. */
export function AcceptanceResponse({ proposalId }: { proposalId: string }) {
  const [declining, setDeclining] = useState(false);
  const [confirmState, confirm, confirmPending] = useFormAction(respondToAcceptance.bind(null, proposalId, true), undefined);
  const [declineState, decline, declinePending] = useFormAction(respondToAcceptance.bind(null, proposalId, false), undefined);

  if (declining) {
    return (
      <form onSubmit={decline} className="space-y-3">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Anything the organizers should know? (optional)</span>
          <textarea name="note" rows={3} maxLength={1000} className="control" placeholder="For example: a clash with another event. A colleague could step in." />
        </label>
        <FormMessage state={declineState} />
        <div className="flex flex-wrap gap-2">
          <SubmitButton variant="danger" pending={declinePending} pendingLabel="Sending…">I can&apos;t give this session</SubmitButton>
          <button type="button" onClick={() => setDeclining(false)} className={buttonClass("ghost")}>Back</button>
        </div>
      </form>
    );
  }
  return (
    <form onSubmit={confirm} className="space-y-3">
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Note to the organizers (optional)</span>
        <input name="note" maxLength={1000} className="control" placeholder="For example: arriving the evening before." />
      </label>
      <FormMessage state={confirmState} />
      <div className="flex flex-wrap gap-2">
        <SubmitButton variant="accent" pending={confirmPending} pendingLabel="Confirming…">Confirm, I&apos;ll be there</SubmitButton>
        <button type="button" onClick={() => setDeclining(true)} className={buttonClass("ghost")}>I can&apos;t make it</button>
      </div>
    </form>
  );
}
