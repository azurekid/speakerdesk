"use client";

import Link from "next/link";
import { useTransition } from "react";
import { FormMessage, ListInput, SubmitButton, useFormAction } from "@/components/form-controls";
import { buttonClass, Card, cx, Field } from "@/components/ui";
import { saveBudget, setDealStatus } from "@/lib/actions/sponsorship";
import { CURRENCIES, SPONSORSHIP_LABELS, SPONSORSHIP_STATUSES, SPONSORSHIP_STYLES, type SponsorshipStatus } from "@/lib/domain";
import type { ActionState } from "@/lib/validation";

export function BudgetForm({ eventId, values }: { eventId: string; values: { currency: string; budgetTarget: number | null; otherIncome: number; prospectusIntro: string } }) {
  const [state, onSubmit, pending] = useFormAction(saveBudget.bind(null, eventId), undefined);
  const e = state?.errors;
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Budget target" htmlFor="budgetTarget" error={e?.budgetTarget} hint="What the event needs to break even.">
          <input id="budgetTarget" name="budgetTarget" type="number" min={0} defaultValue={values.budgetTarget ?? ""} placeholder="e.g. 60000" className="control" />
        </Field>
        <Field label="Other confirmed income" htmlFor="otherIncome" error={e?.otherIncome} hint="Tickets, grants, partners outside SpeakerDesk.">
          <input id="otherIncome" name="otherIncome" type="number" min={0} defaultValue={values.otherIncome} className="control" />
        </Field>
        <Field label="Currency" htmlFor="currency" error={e?.currency}>
          <select id="currency" name="currency" defaultValue={values.currency} className="control">
            {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Prospectus introduction" htmlFor="prospectusIntro" error={e?.prospectusIntro} hint="Shown to sponsors above your packages: audience size, who attends, why sponsor.">
        <textarea id="prospectusIntro" name="prospectusIntro" rows={3} defaultValue={values.prospectusIntro} className="control" placeholder="800 platform engineers and SREs from 30 countries. 70% senior or lead…" />
      </Field>
      <div className="flex items-center gap-3">
        <SubmitButton pending={pending}>Save budget</SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

export function DealStatusSelect({ id, status }: { id: string; status: SponsorshipStatus }) {
  const [pending, startTransition] = useTransition();
  return (
    <select
      aria-label="Deal status"
      defaultValue={status}
      disabled={pending}
      onChange={(ev) => {
        const next = ev.target.value as SponsorshipStatus;
        startTransition(() => setDealStatus(id, next));
      }}
      className={cx("rounded-full border-0 py-1.5 pl-3 pr-8 text-base font-medium ring-1 ring-inset sm:py-1 sm:pl-2.5 sm:pr-7 sm:text-xs", SPONSORSHIP_STYLES[status], pending && "opacity-60")}
    >
      {SPONSORSHIP_STATUSES.map((s) => <option key={s} value={s}>{SPONSORSHIP_LABELS[s]}</option>)}
    </select>
  );
}

export type PackageFormValues = {
  kind: "TIER" | "ADDON"; name: string; tagline: string; price: number | ""; quantity: number | null;
  benefits: string[]; deliverables: string[]; featured: boolean; published: boolean;
};

export const EMPTY_PACKAGE: PackageFormValues = {
  kind: "TIER", name: "", tagline: "", price: "", quantity: null, benefits: [], deliverables: ["Logo (SVG, light and dark)"], featured: false, published: true,
};

export function PackageForm({ values, action, cancelHref, currency }: {
  values: PackageFormValues;
  action: (prev: ActionState, form: FormData) => Promise<ActionState>;
  cancelHref: string;
  currency: string;
}) {
  const [state, onSubmit, pending] = useFormAction(action, undefined);
  const e = state?.errors;
  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <Card title="Package">
        <div className="grid gap-4 sm:grid-cols-2">
          <fieldset className="sm:col-span-2">
            <legend className="mb-2 text-sm font-medium">Type</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {([
                ["TIER", "Sponsorship tier", "A headline package like Gold or Community partner. Sponsors pick one."],
                ["ADDON", "Add-on", "An extra like the coffee bar, lanyards or after-party. Sponsors can add several."],
              ] as const).map(([value, label, hint]) => (
                <label key={value} className="flex cursor-pointer gap-3 rounded-xl border border-line bg-surface p-3 has-checked:border-ink has-checked:ring-1 has-checked:ring-ink">
                  <input type="radio" name="kind" value={value} defaultChecked={values.kind === value} className="mt-1 accent-ink" />
                  <span><span className="text-sm font-medium">{label}</span><br /><span className="text-xs text-ink-soft">{hint}</span></span>
                </label>
              ))}
            </div>
          </fieldset>
          <Field label="Name" htmlFor="name" error={e?.name}>
            <input id="name" name="name" defaultValue={values.name} placeholder="e.g. Gold, Coffee bar" className="control" />
          </Field>
          <Field label="Tagline" htmlFor="tagline" error={e?.tagline}>
            <input id="tagline" name="tagline" defaultValue={values.tagline} placeholder="e.g. Best for hiring" className="control" />
          </Field>
          <Field label={`Price (${currency})`} htmlFor="price" error={e?.price}>
            <input id="price" name="price" type="number" min={0} defaultValue={values.price} className="control" />
          </Field>
          <Field label="Available" htmlFor="quantity" error={e?.quantity} hint="Leave empty for unlimited.">
            <input id="quantity" name="quantity" type="number" min={1} defaultValue={values.quantity ?? ""} placeholder="Unlimited" className="control" />
          </Field>
        </div>
      </Card>
      <div className="grid gap-6 md:grid-cols-2">
        <Card title="What the sponsor gets">
          <ListInput name="benefits" defaultValue={values.benefits} max={20} placeholder="e.g. 6×3 m booth in the main hall" addLabel="+ Add benefit" />
        </Card>
        <Card title="What the sponsor must deliver" description="Becomes a checklist the sponsor works through.">
          <ListInput name="deliverables" defaultValue={values.deliverables} max={15} placeholder="e.g. Booth staff names by 1 May" addLabel="+ Add deliverable" />
        </Card>
      </div>
      <Card>
        <div className="flex flex-wrap gap-6 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" name="featured" defaultChecked={values.featured} className="accent-ink" /> Highlight as “Most popular”</label>
          <label className="flex items-center gap-2"><input type="checkbox" name="published" defaultChecked={values.published} className="accent-ink" /> Show in the prospectus</label>
        </div>
      </Card>
      <div className="flex items-center justify-end gap-3">
        <div className="flex-1"><FormMessage state={state} /></div>
        <Link href={cancelHref} className={buttonClass("ghost")}>Cancel</Link>
        <SubmitButton pending={pending}>Save package</SubmitButton>
      </div>
    </form>
  );
}
