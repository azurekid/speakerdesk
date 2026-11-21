"use client";

import Link from "next/link";
import { FormMessage, SubmitButton, TagInput, useFormAction } from "@/components/form-controls";
import { Card, Field } from "@/components/ui";
import { savePublicProfile } from "@/lib/actions/speaker-public";

export function PublicProfileForm({ values, baseUrl, publishedTalks }: {
  values: { publicProfile: boolean; openToInvites: boolean; slug: string; availabilityNote: string; topics: string[] };
  baseUrl: string;
  publishedTalks: number;
}) {
  const [state, onSubmit, pending] = useFormAction(savePublicProfile, undefined);
  const e = state?.errors;
  return (
    <Card
      title="Public speaker page"
      description="Let organizers find you and invite you to their events. Only your name, tagline, bio, photo, links, location, topics and published talks are shown, never your email or travel details."
      actions={values.publicProfile && values.slug ? <Link href={`/speakers/${values.slug}`} target="_blank" className="text-sm text-ink-soft hover:text-ink">View page ↗</Link> : undefined}
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="flex flex-wrap gap-3">
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-sm has-checked:border-ink">
            <input type="checkbox" name="publicProfile" defaultChecked={values.publicProfile} className="mt-0.5 accent-ink" />
            <span><span className="font-medium">Publish my speaker page</span><br /><span className="text-xs text-ink-soft">Listed in the speaker directory.</span></span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-sm has-checked:border-ink">
            <input type="checkbox" name="openToInvites" defaultChecked={values.openToInvites} className="mt-0.5 accent-ink" />
            <span><span className="font-medium">Open to invitations</span><br /><span className="text-xs text-ink-soft">Organizers can invite you to speak.</span></span>
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Page address" htmlFor="slug" error={e?.slug} hint={`${baseUrl}/speakers/${values.slug || "your-name"}`}>
            <input id="slug" name="slug" defaultValue={values.slug} placeholder="your-name" className="control" />
          </Field>
          <Field label="Availability" htmlFor="availabilityNote" error={e?.availabilityNote}>
            <input id="availabilityNote" name="availabilityNote" defaultValue={values.availabilityNote} placeholder="e.g. Happy to travel within Europe" className="control" />
          </Field>
          <Field label="Topics you speak about" className="sm:col-span-2" hint="Organizers filter the directory by these.">
            <TagInput name="topics" defaultValue={values.topics} prefix="" placeholder="e.g. platform engineering, then Enter" />
          </Field>
        </div>
        <p className="text-xs text-ink-soft">
          {publishedTalks} published talk{publishedTalks === 1 ? "" : "s"}. Publish talks from each <Link href="/sessions" className="underline">session page</Link>.
        </p>
        <div className="flex items-center gap-3">
          <SubmitButton pending={pending}>Save public page</SubmitButton>
          <FormMessage state={state} />
        </div>
      </form>
    </Card>
  );
}
