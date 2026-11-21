"use client";

import Link from "next/link";
import { useState } from "react";
import { SubmitButton, useFormAction } from "@/components/form-controls";
import { Card, cx, Field } from "@/components/ui";
import {
  csvImport, type ImportResult, jsonBackupImport, type LookupState, pretalxImport, pretalxLookup, profilePageImport, sessionizeImport, sessionizeLookup,
} from "@/lib/actions/import";

function Result({ result }: { result: ImportResult }) {
  if (!result) return null;
  if (!result.ok) return <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{result.error}</p>;
  const s = result.summary;
  return (
    <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
      <p className="font-medium">Import complete</p>
      <ul className="mt-1 list-disc pl-5 text-xs">
        <li>{s.talksCreated} new session{s.talksCreated === 1 ? "" : "s"} created{s.talksMatched ? `, ${s.talksMatched} matched existing` : ""}</li>
        {(s.submissionsCreated > 0 || s.submissionsSkipped > 0) && (
          <li>{s.submissionsCreated} submission{s.submissionsCreated === 1 ? "" : "s"} added{s.submissionsSkipped ? `, ${s.submissionsSkipped} already tracked` : ""}</li>
        )}
        {s.profileFieldsFilled > 0 && <li>{s.profileFieldsFilled} empty profile field{s.profileFieldsFilled === 1 ? "" : "s"} filled</li>}
      </ul>
      {result.note && <p className="mt-2 text-xs">{result.note}</p>}
      <p className="mt-2 text-xs">
        <Link href="/sessions" className="font-medium underline">View sessions</Link> · <Link href="/submissions" className="font-medium underline">View submissions</Link>
      </p>
    </div>
  );
}

function SpeakerPicker({ state, children }: { state: Extract<LookupState, { step: "pick" }>; children?: React.ReactNode }) {
  return (
    <>
      {Object.entries(state.context).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <Field label="Which speaker are you?" htmlFor="speakerId" hint={`${state.speakers.length} speakers found.`}>
        <select id="speakerId" name="speakerId" required className="control" defaultValue="">
          <option value="" disabled>Select yourself…</option>
          {state.speakers.map((s) => (
            <option key={s.id} value={s.id}>{s.name}{s.tagline ? `, ${s.tagline}` : ""} ({s.sessionCount})</option>
          ))}
        </select>
      </Field>
      {children}
    </>
  );
}

/** One URL: the speaker's public profile on Sessionize or run.events. */
export function ProfilePageImporter() {
  const [result, onImport, importing] = useFormAction(profilePageImport, undefined);
  return (
    <form onSubmit={onImport} className="space-y-3">
      <Field label="Your public profile URL" htmlFor="profileUrl" hint="e.g. https://sessionize.com/your-name or https://speakers.run.events/your-name">
        <input id="profileUrl" name="profileUrl" type="url" inputMode="url" required placeholder="https://sessionize.com/your-name" className="control" />
      </Field>
      <label className="flex items-center gap-2 text-sm text-ink">
        <input type="checkbox" name="includeProfile" defaultChecked className="rounded border-line" />
        Also fill empty profile fields (bio, tagline, photo, location, links, topics)
      </label>
      <p className="text-xs text-ink-soft">
        Only what&apos;s public on that page is imported. You never need to give SpeakerDesk your Sessionize or run.events password or login.
        Running it again won&apos;t create duplicates.
      </p>
      <SubmitButton pendingLabel="Importing…" pending={importing}>Import from profile</SubmitButton>
      <Result result={result} />
    </form>
  );
}

export function SessionizeImporter() {
  const [lookup, onLookup, looking] = useFormAction(sessionizeLookup, undefined);
  const [result, onImport, importing] = useFormAction(sessionizeImport, undefined);
  return (
    <div className="space-y-4">
      <form onSubmit={onLookup} className="space-y-3">
        <Field label="Sessionize API URL or endpoint id" htmlFor="endpoint" hint="Organizers publish this under API / Embed, e.g. https://sessionize.com/api/v2/abc123xy/view/All">
          <input id="endpoint" name="endpoint" required placeholder="https://sessionize.com/api/v2/…/view/All" className="control" />
        </Field>
        <Field label="Event name" htmlFor="eventName" hint="The API doesn't include the event name, so add it for your tracker.">
          <input id="eventName" name="eventName" placeholder="e.g. Techorama 2026" className="control" />
        </Field>
        <SubmitButton variant="secondary" pendingLabel="Loading…" pending={looking}>Find speakers</SubmitButton>
        {lookup?.step === "error" && <p className="text-sm text-rose-700">{lookup.error}</p>}
      </form>

      {lookup?.step === "pick" && (
        <form onSubmit={onImport} className="space-y-3 border-t border-line pt-4">
          <SpeakerPicker state={lookup}>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" name="includeProfile" defaultChecked className="rounded border-line" />
              Also fill empty profile fields (bio, tagline, photo, links)
            </label>
          </SpeakerPicker>
          <SubmitButton pendingLabel="Importing…" pending={importing}>Import my sessions</SubmitButton>
        </form>
      )}
      <Result result={result} />
    </div>
  );
}

export function PretalxImporter() {
  const [lookup, onLookup, looking] = useFormAction(pretalxLookup, undefined);
  const [result, onImport, importing] = useFormAction(pretalxImport, undefined);
  return (
    <div className="space-y-4">
      <form onSubmit={onLookup} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Pretalx instance" htmlFor="instance" hint="Leave as-is for pretalx.com.">
            <input id="instance" name="instance" defaultValue="https://pretalx.com" className="control" />
          </Field>
          <Field label="Event slug or URL" htmlFor="event">
            <input id="event" name="event" required placeholder="democon or https://pretalx.com/democon/" className="control" />
          </Field>
        </div>
        <Field label="API token (optional)" htmlFor="token" hint="From your pretalx user settings. Used for this import only and never stored. Without a token only the published schedule is visible.">
          <input id="token" name="token" type="password" autoComplete="off" className="control" />
        </Field>
        <SubmitButton variant="secondary" pendingLabel="Loading…" pending={looking}>Find speakers</SubmitButton>
        {lookup?.step === "error" && <p className="text-sm text-rose-700">{lookup.error}</p>}
      </form>

      {lookup?.step === "pick" && (
        <form onSubmit={onImport} className="space-y-3 border-t border-line pt-4">
          <SpeakerPicker state={lookup} />
          <SubmitButton pendingLabel="Importing…" pending={importing}>Import my submissions</SubmitButton>
        </form>
      )}
      <Result result={result} />
    </div>
  );
}

export function FileImporter({ kind }: { kind: "csv" | "json" }) {
  const [result, onSubmit, pending] = useFormAction(kind === "csv" ? csvImport : jsonBackupImport, undefined);
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <input
        type="file"
        name="file"
        required
        accept={kind === "csv" ? ".csv,text/csv" : ".json,application/json"}
        className="block w-full text-sm text-ink-soft file:mr-3 file:rounded-lg file:border-0 file:bg-neutral-100 file:px-3 file:py-2 file:text-sm file:font-medium hover:file:bg-neutral-200"
      />
      <SubmitButton pendingLabel="Importing…" pending={pending}>Import</SubmitButton>
      <Result result={result} />
    </form>
  );
}

const TABS = [
  { id: "profile", label: "Profile page" },
  { id: "sessionize", label: "Sessionize event" },
  { id: "pretalx", label: "Pretalx" },
  { id: "csv", label: "CSV / run.events" },
  { id: "json", label: "SpeakerDesk backup" },
] as const;

export function ImportTabs() {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("profile");
  return (
    <div className="space-y-4">
      <div role="tablist" className="flex flex-wrap gap-1 rounded-lg bg-neutral-100 p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cx("flex-1 rounded-lg px-3 py-1.5 text-sm font-medium", tab === t.id ? "bg-surface text-ink " : "text-ink-soft hover:text-ink")}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Keep every importer mounted so in-progress state survives tab switches. */}
      <div hidden={tab !== "profile"}>
        <Card title="Import from your speaker profile" description="Paste your public Sessionize or run.events profile. Your public sessions become sessions in your library.">
          <ProfilePageImporter />
        </Card>
      </div>
      <div hidden={tab !== "sessionize"}>
        <Card title="Import from a Sessionize event" description="Pulls your sessions at one event (with format, level and track) from the event's public API endpoint, and tracks the submission.">
          <SessionizeImporter />
        </Card>
      </div>
      <div hidden={tab !== "pretalx"}>
        <Card title="Import from Pretalx" description="Pulls your submissions from any pretalx instance via its REST API.">
          <PretalxImporter />
        </Card>
      </div>
      <div hidden={tab !== "csv"}>
        <Card title="Import a CSV" description="Works with run.events and spreadsheet exports. Needs a “title” column; recognised columns include abstract, description, takeaways, format, duration, level, track, tags, event and status.">
          <FileImporter kind="csv" />
        </Card>
      </div>
      <div hidden={tab !== "json"}>
        <Card title="Restore a SpeakerDesk backup" description="Adds sessions and submissions from a JSON export. Existing items with the same title are kept, and only empty profile fields are filled.">
          <FileImporter kind="json" />
        </Card>
      </div>
    </div>
  );
}
