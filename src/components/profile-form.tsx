"use client";

import { useState } from "react";
import { CopyButton, CountedTextarea, FormMessage, SubmitButton, useFormAction } from "@/components/form-controls";
import { Card, Field } from "@/components/ui";
import { saveProfile } from "@/lib/actions/profile";
import { BIO_LIMITS, TSHIRT_SIZES } from "@/lib/domain";
import type { ProfileInput } from "@/lib/validation";

type Errors = Record<string, string[] | undefined> | undefined;

function Text({ name, label, profile, errors, hint, type = "text", placeholder, className }: {
  name: keyof ProfileInput; label: string; profile: ProfileInput; errors: Errors; hint?: string; type?: string; placeholder?: string; className?: string;
}) {
  return (
    <Field label={label} htmlFor={name} hint={hint} error={errors?.[name]} className={className}>
      <input id={name} name={name} type={type} defaultValue={profile[name]} placeholder={placeholder} aria-invalid={errors?.[name] ? true : undefined} className="control" />
    </Field>
  );
}

export function ProfileForm({ profile, timezones }: { profile: ProfileInput; timezones: string[] }) {
  const [state, onSubmit, pending] = useFormAction(saveProfile, undefined);
  const errors = state?.errors;
  const [square, setSquare] = useState(profile.headshotSquareUrl);
  const [wide, setWide] = useState(profile.headshotWideUrl);

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <Card title="Basics" description="How you're introduced on stage and in event listings.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Text name="fullName" label="Full name" profile={profile} errors={errors} />
          <Text name="pronouns" label="Pronouns" profile={profile} errors={errors} placeholder="e.g. she/her" />
          <Text name="tagline" label="Tagline / headline" profile={profile} errors={errors} placeholder="Staff Engineer @ Contoso" className="sm:col-span-2" />
          <Text name="jobTitle" label="Job title" profile={profile} errors={errors} />
          <Text name="company" label="Company" profile={profile} errors={errors} />
        </div>
      </Card>

      <Card title="Bios" description="Keep three lengths ready — CfPs ask for different ones.">
        <div className="space-y-4">
          <CountedTextarea name="bioShort" label="Short bio" limit={BIO_LIMITS.short} defaultValue={profile.bioShort} rows={3} error={errors?.bioShort} hint="One or two sentences, third person." />
          <CountedTextarea name="bioMedium" label="Medium bio" limit={BIO_LIMITS.medium} defaultValue={profile.bioMedium} rows={6} error={errors?.bioMedium} />
          <CountedTextarea name="bioLong" label="Long bio" defaultValue={profile.bioLong} rows={10} error={errors?.bioLong} hint="No limit — for websites and press kits." />
        </div>
      </Card>

      <Card title="Headshots" description="Uploaded images get permanent public URLs you can paste into any CfP.">
        <div className="grid gap-6 sm:grid-cols-2">
          <Headshot kind="square" label="Square (1:1)" url={square} onChange={setSquare} error={errors?.headshotSquareUrl} />
          <Headshot kind="wide" label="Landscape (16:9 / 4:3)" url={wide} onChange={setWide} error={errors?.headshotWideUrl} />
        </div>
      </Card>

      <Card title="Location">
        <div className="grid gap-4 sm:grid-cols-3">
          <Text name="city" label="City" profile={profile} errors={errors} />
          <Text name="country" label="Country" profile={profile} errors={errors} />
          <Field label="Timezone" htmlFor="timezone" error={errors?.timezone}>
            <input id="timezone" name="timezone" list="tz-list" defaultValue={profile.timezone} placeholder="Europe/Amsterdam" className="control" />
            <datalist id="tz-list">{timezones.map((tz) => <option key={tz} value={tz} />)}</datalist>
          </Field>
        </div>
      </Card>

      <Card title="Links">
        <div className="grid gap-4 sm:grid-cols-2">
          <Text name="websiteUrl" label="Website / blog" profile={profile} errors={errors} type="url" placeholder="https://" />
          <Text name="linkedinUrl" label="LinkedIn" profile={profile} errors={errors} type="url" placeholder="https://www.linkedin.com/in/…" />
          <Text name="githubUrl" label="GitHub" profile={profile} errors={errors} type="url" placeholder="https://github.com/…" />
          <Text name="xUrl" label="X / Twitter" profile={profile} errors={errors} type="url" placeholder="https://x.com/…" />
          <Text name="blueskyUrl" label="Bluesky" profile={profile} errors={errors} type="url" placeholder="https://bsky.app/profile/…" />
          <Text name="mastodonUrl" label="Mastodon" profile={profile} errors={errors} type="url" placeholder="https://…" />
          <Text name="youtubeUrl" label="YouTube" profile={profile} errors={errors} type="url" placeholder="https://youtube.com/@…" />
          <Text name="sessionizeUrl" label="Sessionize profile" profile={profile} errors={errors} type="url" placeholder="https://sessionize.com/…" />
        </div>
      </Card>

      <Card title="Travel & logistics" description="Often requested after acceptance. Only you can see this.">
        <div className="grid gap-4 sm:grid-cols-3">
          <Text name="homeAirport" label="Home airport" profile={profile} errors={errors} placeholder="AMS" hint="IATA code" />
          <Field label="T-shirt size" htmlFor="tshirtSize" error={errors?.tshirtSize}>
            <select id="tshirtSize" name="tshirtSize" defaultValue={profile.tshirtSize} className="control">
              {TSHIRT_SIZES.map((s) => <option key={s} value={s}>{s || "—"}</option>)}
            </select>
          </Field>
          <Text name="dietaryRestrictions" label="Dietary restrictions" profile={profile} errors={errors} />
          <Text name="accessibilityNeeds" label="Accessibility needs" profile={profile} errors={errors} className="sm:col-span-3" />
          <Field label="Travel notes" htmlFor="travelNotes" error={errors?.travelNotes} className="sm:col-span-3">
            <textarea id="travelNotes" name="travelNotes" rows={3} defaultValue={profile.travelNotes} className="control" placeholder="Frequent flyer numbers, seat preference, visa notes…" />
          </Field>
        </div>
      </Card>

      <div className="sticky bottom-0 -mx-4 flex items-center justify-end gap-3 border-t border-line bg-neutral-50/90 px-4 py-3 backdrop-blur sm:-mx-8 sm:px-8">
        <div className="flex-1"><FormMessage state={state} /></div>
        <SubmitButton pending={pending}>Save profile</SubmitButton>
      </div>
    </form>
  );
}

function Headshot({ kind, label, url, onChange, error }: { kind: "square" | "wide"; label: string; url: string; onChange: (url: string) => void; error?: string[] }) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const name = kind === "square" ? "headshotSquareUrl" : "headshotWideUrl";

  async function upload(file: File) {
    setUploading(true);
    setUploadError(null);
    const body = new FormData();
    body.set("kind", kind);
    body.set("file", file);
    const res = await fetch("/api/upload/headshot", { method: "POST", body });
    const json = await res.json().catch(() => ({}));
    setUploading(false);
    if (!res.ok) return setUploadError(json.error ?? "Upload failed");
    onChange(json.url);
  }

  return (
    <div>
      <p className="mb-2 text-sm font-medium text-ink">{label}</p>
      <div className={kind === "square" ? "aspect-square w-40" : "aspect-video w-full"}>
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element -- arbitrary user/CDN hosts
          <img src={url} alt={`${label} headshot`} className="h-full w-full rounded-lg border border-line object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center rounded-lg border border-dashed border-line text-xs text-neutral-400">No image</div>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label className="cursor-pointer rounded-lg bg-surface px-2.5 py-1.5 text-xs font-medium text-ink ring-1 ring-inset ring-line hover:bg-neutral-50">
          {uploading ? "Uploading…" : "Upload image"}
          <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={uploading} onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        </label>
        <CopyButton text={url} label="Copy URL" />
      </div>
      <input name={name} value={url} onChange={(e) => onChange(e.target.value)} placeholder="…or paste an image URL" className="control mt-2 text-xs" />
      {(uploadError || error?.[0]) && <p className="mt-1 text-xs text-rose-700">{uploadError ?? error?.[0]}</p>}
    </div>
  );
}
