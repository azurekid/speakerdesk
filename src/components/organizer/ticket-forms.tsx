"use client";

import Papa from "papaparse";
import { useState, useTransition } from "react";
import { FormMessage, SubmitButton, useFormAction } from "@/components/form-controls";
import { buttonClass, Card, cx, Field } from "@/components/ui";
import { addRegistrant, addTicketType, importRegistrants, saveRegistrationSettings, updateTicketType } from "@/lib/actions/tickets";
import { guessMapping, IMPORT_FIELD_LABELS, IMPORT_FIELDS, IMPORT_PLATFORMS, type ImportPlatform, type Mapping, mapRows } from "@/lib/registrant-import";

type TicketTypeOption = { id: string; name: string; published: boolean };

// ─── Registration settings (setup step 4) ────────────────────────────────────

export function RegistrationSettingsForm({ eventId, values }: {
  eventId: string;
  values: { registrationOpen: boolean; registrationCapacity: string; registrationClosesAt: string; registrationNote: string; sponsorSharingEnabled: boolean };
}) {
  const [state, onSubmit, pending] = useFormAction(saveRegistrationSettings.bind(null, eventId), undefined);
  const e = state?.errors;
  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <Card title="Registration" description="Attendees register on your event page and get a ticket with a QR code by email. SpeakerDesk tickets are free: it doesn't take payments.">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex items-start gap-3 rounded-md border border-line px-3 py-2.5 text-sm sm:col-span-2">
            <input type="checkbox" name="registrationOpen" defaultChecked={values.registrationOpen} className="mt-0.5 accent-ink" />
            <span>
              <span className="font-medium">Open registration on the event page</span>
              <span className="block text-ink-soft">This also makes the event page public, even without a call for papers.</span>
            </span>
          </label>
          <Field label="Maximum attendees" htmlFor="registrationCapacity" error={e?.registrationCapacity} hint="Across all ticket types. Leave empty for no limit.">
            <input id="registrationCapacity" name="registrationCapacity" type="number" min={1} defaultValue={values.registrationCapacity} className="control" placeholder="No limit" />
          </Field>
          <Field label="Registration closes" htmlFor="registrationClosesAt" error={e?.registrationClosesAt} hint="Open through the end of this day (UTC). Empty: until the event ends.">
            <input id="registrationClosesAt" name="registrationClosesAt" type="date" defaultValue={values.registrationClosesAt} className="control" />
          </Field>
          <Field label="Note above the form" htmlFor="registrationNote" error={e?.registrationNote} className="sm:col-span-2">
            <input id="registrationNote" name="registrationNote" maxLength={500} defaultValue={values.registrationNote} className="control" placeholder="e.g. Free. Please cancel your ticket if you can't come." />
          </Field>
          <label className="flex items-start gap-3 rounded-md border border-line px-3 py-2.5 text-sm sm:col-span-2">
            <input type="checkbox" name="sponsorSharingEnabled" defaultChecked={values.sponsorSharingEnabled} className="mt-0.5 accent-ink" />
            <span>
              <span className="font-medium">Ask attendees if sponsors may contact them</span>
              <span className="block text-ink-soft">
                Adds an unticked checkbox to the form. Only people who tick it appear in the sponsor export. Imported attendees never do: they weren&apos;t asked.
              </span>
            </span>
          </label>
        </div>
      </Card>
      <div className="flex flex-wrap items-center justify-end gap-3">
        <div className="min-w-0 flex-1"><FormMessage state={state} /></div>
        <button type="submit" disabled={pending} className={buttonClass("secondary")}>{pending ? "Saving…" : "Save"}</button>
        <button type="submit" name="intent" value="continue" disabled={pending} className={buttonClass("primary")}>Save and continue →</button>
      </div>
    </form>
  );
}

// ─── Ticket types ────────────────────────────────────────────────────────────

export function TicketTypeForm({ eventId, type }: {
  eventId: string;
  type?: { id: string; name: string; description: string; capacity: number | null; priceLabel: string; published: boolean };
}) {
  const action = type ? updateTicketType.bind(null, type.id) : addTicketType.bind(null, eventId);
  const [state, onSubmit, pending] = useFormAction(action, undefined);
  const e = state?.errors;
  return (
    // A fresh form after adding, so the fields clear.
    <form onSubmit={onSubmit} key={!type && state?.ok ? state.message : "form"} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr]">
        <Field label="Ticket name" htmlFor={`tt-name-${type?.id ?? "new"}`} error={e?.name}>
          <input id={`tt-name-${type?.id ?? "new"}`} name="name" required maxLength={80} defaultValue={type?.name} placeholder="General admission" className="control" />
        </Field>
        <Field label="How many" htmlFor={`tt-cap-${type?.id ?? "new"}`} error={e?.capacity}>
          <input id={`tt-cap-${type?.id ?? "new"}`} name="capacity" type="number" min={1} defaultValue={type?.capacity ?? ""} placeholder="No limit" className="control" />
        </Field>
        <Field label="Price shown" htmlFor={`tt-price-${type?.id ?? "new"}`} error={e?.priceLabel}>
          <input id={`tt-price-${type?.id ?? "new"}`} name="priceLabel" maxLength={60} defaultValue={type?.priceLabel ?? ""} placeholder="Free" className="control" />
        </Field>
      </div>
      <Field label="Description (optional)" htmlFor={`tt-desc-${type?.id ?? "new"}`} error={e?.description}>
        <input id={`tt-desc-${type?.id ?? "new"}`} name="description" maxLength={300} defaultValue={type?.description ?? ""} placeholder="Both days, lunch included" className="control" />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="published" defaultChecked={type?.published ?? true} className="accent-ink" />
        Attendees can pick this ticket <span className="text-ink-soft">(untick for Speaker or Crew tickets you hand out yourself)</span>
      </label>
      <FormMessage state={state} />
      <SubmitButton pending={pending} variant={type ? "secondary" : "primary"}>{type ? "Save ticket" : "Add ticket type"}</SubmitButton>
    </form>
  );
}

// ─── Attendees: add one, import many ─────────────────────────────────────────

export function AddRegistrantForm({ eventId, types }: { eventId: string; types: TicketTypeOption[] }) {
  const [state, onSubmit, pending] = useFormAction(addRegistrant.bind(null, eventId), undefined);
  const e = state?.errors;
  return (
    <form onSubmit={onSubmit} key={state?.ok ? state.message : "form"} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name" htmlFor="ar-name" error={e?.name}><input id="ar-name" name="name" required maxLength={150} className="control" /></Field>
        <Field label="Email" htmlFor="ar-email" error={e?.email}><input id="ar-email" name="email" type="email" maxLength={254} className="control" placeholder="Optional" /></Field>
        <Field label="Company" htmlFor="ar-company"><input id="ar-company" name="company" maxLength={150} className="control" /></Field>
        <Field label="Job title" htmlFor="ar-job"><input id="ar-job" name="jobTitle" maxLength={150} className="control" /></Field>
        {types.length > 0 && (
          <Field label="Ticket" htmlFor="ar-type" className="sm:col-span-2">
            <select id="ar-type" name="ticketTypeId" className="control">
              {types.map((t) => <option key={t.id} value={t.id}>{t.name}{t.published ? "" : " (organizers only)"}</option>)}
            </select>
          </Field>
        )}
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="sendTicket" defaultChecked className="accent-ink" /> Email the ticket now</label>
      <FormMessage state={state} />
      <SubmitButton pending={pending}>Add attendee</SubmitButton>
    </form>
  );
}

/**
 * Import from another platform: read the CSV in the browser, guess which column is which, let
 * the organizer check the mapping and a preview, then send the mapped rows.
 */
export function ImportRegistrants({ eventId, types }: { eventId: string; types: TicketTypeOption[] }) {
  const [platform, setPlatform] = useState<ImportPlatform>("meetup");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Mapping>({});
  const [ticketTypeId, setTicketTypeId] = useState(types[0]?.id ?? "");
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, start] = useTransition();
  const mapped = mapRows(rows, mapping);

  function onFile(file: File | undefined) {
    setResult(null);
    if (!file) return;
    if (file.size > 5_000_000) return setResult({ ok: false, message: "That file is over 5 MB. Split it, or export fewer columns." });
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: "greedy",
      complete: (r) => {
        const fields = (r.meta.fields ?? []).filter(Boolean);
        if (!fields.length) return setResult({ ok: false, message: "No columns found. Is this a CSV file with a header row?" });
        setHeaders(fields);
        setRows(r.data);
        setMapping(guessMapping(fields));
      },
      error: () => setResult({ ok: false, message: "This file couldn't be read as CSV." }),
    });
  }

  const hint = IMPORT_PLATFORMS.find((p) => p.id === platform)?.hint;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Import from">
        {IMPORT_PLATFORMS.map((p) => (
          <label key={p.id} className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-line px-3 py-1.5 text-sm has-checked:border-ink has-checked:bg-neutral-50">
            <input type="radio" name="platform" value={p.id} checked={platform === p.id} onChange={() => setPlatform(p.id)} className="accent-ink" />
            {p.label}
          </label>
        ))}
      </div>
      <p className="text-sm text-ink-soft">{hint}</p>
      <input type="file" accept=".csv,text/csv" onChange={(ev) => onFile(ev.target.files?.[0])} className="block text-sm file:mr-3 file:rounded-md file:border file:border-line file:bg-surface file:px-3 file:py-1.5 file:text-sm" />

      {headers.length > 0 && (
        <>
          <div>
            <p className="mb-2 text-sm font-medium">Which column is which?</p>
            <div className="grid gap-2 sm:grid-cols-3">
              {IMPORT_FIELDS.map((f) => (
                <label key={f} className="text-sm">
                  <span className="mb-1 block text-xs text-ink-soft">{IMPORT_FIELD_LABELS[f]}</span>
                  <select value={mapping[f] ?? ""} onChange={(ev) => setMapping((m) => ({ ...m, [f]: ev.target.value || undefined }))} className="control">
                    <option value="">(none)</option>
                    {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </label>
              ))}
            </div>
            <p className="mt-2 text-xs text-ink-soft">Use Full name, or First and Last name. Rows without a name are skipped.</p>
          </div>

          <div className="overflow-x-auto rounded-lg border border-line">
            <table className="w-full text-left text-sm">
              <thead className="bg-neutral-50 text-xs text-ink-soft">
                <tr><th className="px-3 py-2">Name</th><th className="px-3 py-2">Email</th><th className="px-3 py-2">Company</th><th className="px-3 py-2">Job title</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {mapped.rows.slice(0, 5).map((r, i) => (
                  <tr key={i}><td className="px-3 py-2">{r.name}</td><td className={cx("px-3 py-2", !r.email && "text-ink-soft")}>{r.email || "no email"}</td><td className="px-3 py-2">{r.company}</td><td className="px-3 py-2">{r.jobTitle}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-sm text-ink-soft">
            {mapped.rows.length} {mapped.rows.length === 1 ? "person" : "people"} to import
            {mapped.skipped > 0 && `, ${mapped.skipped} rows without a name skipped`}
            {mapped.rows.some((r) => !r.email) && `, ${mapped.rows.filter((r) => !r.email).length} without an email`}.
          </p>

          <div className="flex flex-wrap items-end gap-3">
            {types.length > 0 && (
              <label className="text-sm">
                <span className="mb-1 block text-xs text-ink-soft">Ticket</span>
                <select value={ticketTypeId} onChange={(ev) => setTicketTypeId(ev.target.value)} className="control">
                  {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </label>
            )}
            <button
              type="button"
              disabled={pending || !mapped.rows.length}
              onClick={() =>
                start(async () => {
                  const r = await importRegistrants(eventId, { platform, ticketTypeId, rows: mapped.rows });
                  setResult(r);
                  if (r.ok) {
                    setHeaders([]);
                    setRows([]);
                  }
                })
              }
              className={buttonClass("primary")}
            >
              {pending ? "Importing…" : `Import ${mapped.rows.length} ${mapped.rows.length === 1 ? "person" : "people"}`}
            </button>
          </div>
        </>
      )}
      {result && <FormMessage state={result} />}
    </div>
  );
}
