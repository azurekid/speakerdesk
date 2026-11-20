"use client";

import { useState } from "react";
import { FormMessage, SubmitButton, useFormAction } from "@/components/form-controls";
import { Card, Field } from "@/components/ui";
import { saveSponsorOrg } from "@/lib/actions/sponsorship";

type Values = { name: string; website: string; logoUrl: string; description: string; contactName: string; contactEmail: string };

export function CompanyForm({ values, next }: { values: Values; next?: string }) {
  const [state, onSubmit, pending] = useFormAction(saveSponsorOrg, undefined);
  const [logo, setLogo] = useState(values.logoUrl);
  const e = state?.errors;
  const input = (name: keyof Values, label: string, opts: { type?: string; placeholder?: string; hint?: string } = {}) => (
    <Field label={label} htmlFor={name} error={e?.[name]} hint={opts.hint}>
      <input id={name} name={name} type={opts.type ?? "text"} defaultValue={values[name]} placeholder={opts.placeholder} className="control" onChange={name === "logoUrl" ? (ev) => setLogo(ev.target.value) : undefined} />
    </Field>
  );
  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {next && <input type="hidden" name="next" value={next} />}
      <Card title="Company">
        <div className="grid gap-4 sm:grid-cols-2">
          {input("name", "Company name", { placeholder: "Contoso Cloud" })}
          {input("website", "Website", { type: "url", placeholder: "https://" })}
          <div className="sm:col-span-2 grid gap-4 sm:grid-cols-[1fr_auto]">
            {input("logoUrl", "Logo URL", { type: "url", placeholder: "https://…/logo.svg", hint: "Shown on event pages once your sponsorship is confirmed." })}
            <div className="grid size-20 place-items-center rounded-xl border border-line bg-surface p-2">
              {logo ? (
                // eslint-disable-next-line @next/next/no-img-element -- sponsor-provided logo host
                <img src={logo} alt="Logo preview" className="max-h-full max-w-full object-contain" />
              ) : (
                <span className="text-xs text-ink-soft">Logo</span>
              )}
            </div>
          </div>
          <Field label="About the company" htmlFor="description" error={e?.description} className="sm:col-span-2">
            <textarea id="description" name="description" rows={3} defaultValue={values.description} className="control" placeholder="Two sentences organizers can use to introduce you." />
          </Field>
        </div>
      </Card>
      <Card title="Sponsorship contact">
        <div className="grid gap-4 sm:grid-cols-2">
          {input("contactName", "Name")}
          {input("contactEmail", "Email", { type: "email" })}
        </div>
      </Card>
      <div className="flex items-center justify-end gap-3">
        <div className="flex-1"><FormMessage state={state} /></div>
        <SubmitButton pending={pending}>{next ? "Save and continue" : "Save company"}</SubmitButton>
      </div>
    </form>
  );
}
