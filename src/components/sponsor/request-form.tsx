"use client";

import { Check } from "lucide-react";
import { useState } from "react";
import { FormMessage, SubmitButton, useFormAction } from "@/components/form-controls";
import { RequirementPicker } from "@/components/requirement-picker";
import { Card, cx, Field } from "@/components/ui";
import { formatMoney } from "@/lib/domain";
import { SPONSOR_REQUIREMENTS } from "@/lib/requirements";
import type { ActionState } from "@/lib/validation";

export type OfferPackage = {
  id: string; kind: "TIER" | "ADDON"; name: string; tagline: string; price: number; left: number | null;
  benefits: string[]; deliverables: string[]; featured: boolean;
};

export function SponsorRequestForm({ packages, currency, action }: {
  packages: OfferPackage[];
  currency: string;
  action: (prev: ActionState, form: FormData) => Promise<ActionState>;
}) {
  const [state, onSubmit, pending] = useFormAction(action, undefined);
  const tiers = packages.filter((p) => p.kind === "TIER");
  const addons = packages.filter((p) => p.kind === "ADDON");
  const [tier, setTier] = useState<string>(tiers.find((t) => t.featured && t.left !== 0)?.id ?? "");
  const [extras, setExtras] = useState<string[]>([]);
  const selected = packages.filter((p) => p.id === tier || extras.includes(p.id));
  const total = selected.reduce((n, p) => n + p.price, 0);
  const deliverables = [...new Set(selected.flatMap((p) => p.deliverables))];

  return (
    <form onSubmit={onSubmit} className="space-y-10">
      {tiers.length > 0 && (
        <section>
          <h2 className="text-2xl font-semibold tracking-tight">Choose a package</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {tiers.map((p) => {
              const soldOut = p.left === 0;
              const checked = tier === p.id;
              return (
                <label key={p.id} className={cx("relative flex cursor-pointer flex-col rounded-2xl border bg-surface p-5 transition", checked ? "border-ink ring-2 ring-ink" : "border-line hover:border-neutral-400", soldOut && "cursor-not-allowed opacity-50")}>
                  <input type="radio" name="tierChoice" value={p.id} checked={checked} disabled={soldOut} onChange={() => setTier(p.id)} onClick={() => checked && setTier("")} className="sr-only" />
                  {p.featured && <span className="absolute -top-3 left-5 rounded-full bg-brand-500 px-2.5 py-0.5 text-xs font-medium text-white">Most popular</span>}
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-semibold">{p.name}</span>
                    <span className={cx("grid size-5 place-items-center rounded-full border", checked ? "border-ink bg-ink text-paper" : "border-neutral-300")}>{checked && <Check className="size-3" strokeWidth={3} />}</span>
                  </div>
                  {p.tagline && <span className="text-sm text-ink-soft">{p.tagline}</span>}
                  <span className="mt-3 text-3xl font-semibold tracking-tight tabular-nums">{formatMoney(p.price, currency)}</span>
                  <span className={cx("text-xs", soldOut ? "font-medium text-rose-700" : p.left !== null && p.left <= 2 ? "font-medium text-brand-700" : "text-ink-soft")}>
                    {soldOut ? "Sold out" : p.left === null ? "Available" : `${p.left} left`}
                  </span>
                  <ul className="mt-4 space-y-1.5 text-sm">
                    {p.benefits.map((b) => <li key={b} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-emerald-600" />{b}</li>)}
                  </ul>
                </label>
              );
            })}
          </div>
        </section>
      )}

      {addons.length > 0 && (
        <section>
          <h2 className="text-2xl font-semibold tracking-tight">Add-ons</h2>
          <p className="mt-1 text-sm text-ink-soft">Stand out with something people remember. Combine as many as you like, with or without a package.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {addons.map((p) => {
              const soldOut = p.left === 0;
              const checked = extras.includes(p.id);
              return (
                <label key={p.id} className={cx("flex cursor-pointer gap-3 rounded-2xl border bg-surface p-4 transition", checked ? "border-ink ring-1 ring-ink" : "border-line hover:border-neutral-400", soldOut && "cursor-not-allowed opacity-50")}>
                  <input type="checkbox" checked={checked} disabled={soldOut} onChange={(e) => setExtras((x) => (e.target.checked ? [...x, p.id] : x.filter((id) => id !== p.id)))} className="mt-1 accent-ink" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="font-medium">{p.name}</span>
                      <span className="font-semibold tabular-nums">{formatMoney(p.price, currency)}</span>
                    </span>
                    {p.tagline && <span className="block text-sm text-ink-soft">{p.tagline}</span>}
                    {p.benefits.length > 0 && <span className="mt-1 block text-xs text-ink-soft">{p.benefits.join(" · ")}</span>}
                    <span className={cx("mt-1 block text-xs", soldOut ? "text-rose-700" : "text-ink-soft")}>{soldOut ? "Sold out" : p.left === null ? "" : `${p.left} left`}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </section>
      )}

      <section className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Card title="What you need" description="Tell the organizers what you need on site, so it's planned from day one.">
          <RequirementPicker name="requirements" groups={SPONSOR_REQUIREMENTS} />
          <Field label="Other requirements" htmlFor="requirementsNote" className="mt-5">
            <textarea id="requirementsNote" name="requirementsNote" rows={2} className="control" placeholder="e.g. We bring a 2 m backdrop and need a 16 A socket" />
          </Field>
          <Field label="Message to the organizers" htmlFor="message" className="mt-4">
            <textarea id="message" name="message" rows={3} className="control" placeholder="What you hope to get out of the event, invoicing details, questions…" />
          </Field>
        </Card>

        <aside className="lg:sticky lg:top-8 lg:self-start">
          <div className="rounded-2xl bg-night p-6 text-white">
            <h3 className="font-semibold">Your selection</h3>
            {selected.length === 0 ? (
              <p className="mt-3 text-sm text-white/60">Pick a package or add-on.</p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm">
                {selected.map((p) => (
                  <li key={p.id} className="flex justify-between gap-3">
                    <span>{p.name}</span>
                    <span className="tabular-nums text-white/80">{formatMoney(p.price, currency)}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4 flex items-baseline justify-between border-t border-white/15 pt-4">
              <span className="text-sm text-white/70">Total</span>
              <span className="text-3xl font-semibold tracking-tight tabular-nums">{formatMoney(total, currency)}</span>
            </div>
            {deliverables.length > 0 && (
              <div className="mt-4 text-xs text-white/70">
                <p className="font-medium text-white">You&apos;ll be asked to provide</p>
                <ul className="mt-1 list-disc pl-4">{deliverables.map((d) => <li key={d}>{d}</li>)}</ul>
              </div>
            )}
            {tier && <input type="hidden" name="packageIds" value={tier} />}
            {extras.map((id) => <input key={id} type="hidden" name="packageIds" value={id} />)}
            <div className="mt-6 [&_button]:w-full [&_button]:bg-brand-500 [&_button]:hover:bg-brand-600">
              <SubmitButton pending={pending} pendingLabel="Sending request…">Request sponsorship</SubmitButton>
            </div>
            <p className="mt-3 text-center text-[11px] text-white/50">No payment now. The organizers confirm and send an invoice.</p>
          </div>
          <div className="mt-3"><FormMessage state={state} /></div>
        </aside>
      </section>
    </form>
  );
}
