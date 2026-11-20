import type { Metadata } from "next";
import { Suspense } from "react";
import { ProfileForm } from "@/components/profile-form";
import { PageHeader, Skeleton } from "@/components/ui";
import { getOrCreateProfile, requireUser } from "@/lib/dal";
import { PublicProfileForm } from "@/components/speakers/public-profile-form";
import { prisma } from "@/lib/db";
import { appUrl } from "@/lib/organizer";
import { profileSchema } from "@/lib/validation";

export const metadata: Metadata = { title: "Profile" };

export default function ProfilePage() {
  return (
    <>
      <PageHeader eyebrow="Speaker badge" title="Speaker profile" description="Your canonical speaker details, reused across every CfP." />
      <Suspense fallback={<Skeleton rows={5} />}>
        <ProfileContent />
      </Suspense>
    </>
  );
}

async function ProfileContent() {
  const user = await requireUser();
  const [profile, publishedTalks] = await Promise.all([getOrCreateProfile(user), prisma.talk.count({ where: { userId: user.id, published: true, archived: false } })]);
  // Strip ids/timestamps: only the editable fields go to the client.
  const editable = Object.fromEntries(Object.keys(profileSchema.shape).map((k) => [k, (profile as Record<string, unknown>)[k] ?? ""])) as never;
  const name = profile.fullName || user.name;
  const initials = name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  const location = [profile.city, profile.country].filter(Boolean).join(", ");
  return (
    <>
      {/* How organizers see you on a proposal or programme page */}
      <section className="mb-8 grid gap-6 rounded-xl border border-line bg-surface p-6 sm:grid-cols-[auto_1fr]">
        {profile.headshotSquareUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- arbitrary CDN hosts
          <img src={profile.headshotSquareUrl} alt="" className="size-28 rounded-full object-cover" />
        ) : (
          <span className="grid size-28 place-items-center rounded-full bg-neutral-200 font-display tracking-tight text-4xl text-ink-soft">{initials}</span>
        )}
        <div className="min-w-0">
          <p className="text-[11px] text-ink-soft">How organizers see you</p>
          <p className="mt-1 font-display text-3xl font-semibold tracking-tight">{name}</p>
          <p className="text-ink-soft">{profile.tagline || "Add a tagline so organizers know who you are"}{location && ` · ${location}`}</p>
          {profile.bioShort && <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-soft">{profile.bioShort}</p>}
        </div>
      </section>
      <div className="mb-8">
        <PublicProfileForm
          baseUrl={appUrl()}
          publishedTalks={publishedTalks}
          values={{ publicProfile: profile.publicProfile, openToInvites: profile.openToInvites, slug: profile.slug ?? "", availabilityNote: profile.availabilityNote, topics: profile.topics }}
        />
      </div>
      <ProfileForm profile={editable} timezones={Intl.supportedValuesOf("timeZone")} />
    </>
  );
}
