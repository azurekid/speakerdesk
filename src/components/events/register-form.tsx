"use client";

import { FormMessage, SubmitButton, useFormAction } from "@/components/form-controls";
import { cx, Field } from "@/components/ui";
import { registerForEvent } from "@/lib/actions/tickets";

type TicketOption = { id: string; name: string; description: string; priceLabel: string; left: number | null };

/** The public registration form. The ticket arrives by email, with a QR code for the door. */
export function RegisterForm({ eventId, eventName, types, askSponsorConsent, note }: { eventId: string; eventName: string; types: TicketOption[]; askSponsorConsent: boolean; note: string }) {
  const [state, onSubmit, pending] = useFormAction(registerForEvent.bind(null, eventId), undefined);
  const e = state?.errors;
  if (state?.ok) return <FormMessage state={state} />;
  const firstOpen = types.find((t) => t.left !== 0)?.id;
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {note && <p className="text-sm text-ink-soft">{note}</p>}
      {types.length > 0 && (
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Ticket</legend>
          <div className="space-y-2">
            {types.map((t) => (
              <label key={t.id} className={cx("flex cursor-pointer items-start gap-3 rounded-lg border border-line px-3 py-2 text-sm has-checked:border-ink", t.left === 0 && "cursor-not-allowed opacity-50")}>
                <input type="radio" name="ticketTypeId" value={t.id} defaultChecked={t.id === firstOpen} disabled={t.left === 0} className="mt-1 accent-ink" />
                <span className="min-w-0 flex-1">
                  <span className="flex justify-between gap-2"><span className="font-medium">{t.name}</span><span className="text-ink-soft">{t.left === 0 ? "Sold out" : t.priceLabel}</span></span>
                  {t.description && <span className="block text-xs text-ink-soft">{t.description}</span>}
                  {t.left !== null && t.left > 0 && t.left <= 20 && <span className="block text-xs text-amber-800">{t.left} left</span>}
                </span>
              </label>
            ))}
          </div>
          {e?.ticketTypeId && <p className="mt-1 text-xs text-rose-700">{e.ticketTypeId[0]}</p>}
        </fieldset>
      )}
      <Field label="Name" htmlFor="reg-name" error={e?.name}><input id="reg-name" name="name" required maxLength={150} autoComplete="name" className="control" /></Field>
      <Field label="Email" htmlFor="reg-email" error={e?.email} hint="Your ticket with the QR code goes here.">
        <input id="reg-email" name="email" type="email" required maxLength={254} autoComplete="email" className="control" />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        <Field label="Company" htmlFor="reg-company"><input id="reg-company" name="company" maxLength={150} autoComplete="organization" className="control" placeholder="Optional" /></Field>
        <Field label="Job title" htmlFor="reg-job"><input id="reg-job" name="jobTitle" maxLength={150} autoComplete="organization-title" className="control" placeholder="Optional" /></Field>
      </div>
      {askSponsorConsent && (
        <label className="flex items-start gap-2 text-xs text-ink-soft">
          <input type="checkbox" name="shareWithSponsors" className="mt-0.5 accent-ink" />
          <span>The sponsors of {eventName} may contact me. They get my name, email, company and job title. Optional.</span>
        </label>
      )}
      <FormMessage state={state} />
      <SubmitButton pending={pending} variant="accent" pendingLabel="Registering…">Get my ticket</SubmitButton>
      <p className="text-xs text-ink-soft">By registering you agree to the <a href="/privacy" className="underline">privacy notice</a>.</p>
    </form>
  );
}
