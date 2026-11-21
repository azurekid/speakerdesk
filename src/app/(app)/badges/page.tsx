import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BadgeMedal } from "@/components/badge-medal";
import { ActionButton } from "@/components/form-controls";
import { EmptyState, formatDate, PageHeader, Skeleton } from "@/components/ui";
import { respondToBadge, setBadgeVisibility } from "@/lib/actions/badges";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/dal";

export const metadata: Metadata = { title: "Badges" };

export default function MyBadgesPage() {
  return (
    <>
      <PageHeader eyebrow="Recognition" title="Badges" description="Badges events gave you for speaking, volunteering and organizing. Accept them to add them to your profile." />
      <Suspense fallback={<Skeleton rows={4} />}>
        <MyBadges />
      </Suspense>
    </>
  );
}

async function MyBadges() {
  const user = await requireUser();
  const [awards, profile] = await Promise.all([
    prisma.badgeAward.findMany({
      where: { recipientId: user.id, status: { in: ["PENDING", "ACCEPTED"] } },
      include: { badge: true, event: { select: { name: true, slug: true, startDate: true, cfpPublished: true, programPublished: true } }, awardedBy: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.speakerProfile.findUnique({ where: { userId: user.id }, select: { publicProfile: true, slug: true } }),
  ]);
  const pending = awards.filter((a) => a.status === "PENDING");
  const accepted = awards.filter((a) => a.status === "ACCEPTED");
  if (!awards.length) {
    return <EmptyState title="No badges yet" photo="/images/events/main-stage.jpg">When an event recognises you as a speaker, volunteer or organizer, the badge shows up here for you to accept.</EmptyState>;
  }

  return (
    <div className="space-y-10">
      {pending.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold tracking-tight">Waiting for you ({pending.length})</h2>
          <ul className="space-y-3">
            {pending.map((a) => (
              <li key={a.id} className="flex flex-col items-center gap-4 rounded-2xl border border-brand-200 bg-brand-50/40 p-5 text-center sm:flex-row sm:text-left">
                <BadgeMedal icon={a.badge.icon} color={a.badge.color} size="lg" label={a.badge.name} eventName={a.event.name} date={a.event.startDate} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{a.badge.name}</p>
                  <p className="text-sm text-ink-soft">From {a.event.name}{a.awardedBy && ` · given by ${a.awardedBy.name}`} · {formatDate(a.createdAt)}</p>
                  {a.badge.description && <p className="mt-1 text-sm">{a.badge.description}</p>}
                  {a.message && <p className="mt-1 text-sm italic text-ink-soft">“{a.message}”</p>}
                </div>
                <div className="flex gap-2">
                  <ActionButton action={respondToBadge.bind(null, a.id, true)} variant="primary">Accept</ActionButton>
                  <ActionButton action={respondToBadge.bind(null, a.id, false)} variant="ghost" confirmText={`Decline “${a.badge.name}”? ${a.event.name} won't be able to give it to you again.`}>Decline</ActionButton>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {accepted.length > 0 && (
        <section>
          <h2 className="mb-1 text-lg font-semibold tracking-tight">Your badges ({accepted.length})</h2>
          <p className="mb-4 text-sm text-ink-soft">
            {profile?.publicProfile && profile.slug ? (
              <>Visible badges appear on <Link href={`/speakers/${profile.slug}`} className="underline">your public speaker page</Link>.</>
            ) : (
              <>Turn on your <Link href="/profile" className="underline">public speaker page</Link> to show them there. Each visible badge also has its own page you can share.</>
            )}
          </p>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {accepted.map((a) => (
              <li key={a.id} className="flex flex-col items-center rounded-2xl border border-line bg-surface p-5 text-center">
                <BadgeMedal icon={a.badge.icon} color={a.badge.color} size="lg" muted={!a.showOnProfile} label={a.badge.name} eventName={a.event.name} date={a.event.startDate} className="size-44" />
                <p className="mt-3 font-medium">{a.badge.name}</p>
                <p className="text-xs text-ink-soft">{a.event.name} · {formatDate(a.createdAt)}</p>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                  {a.showOnProfile ? (
                    <>
                      <Link href={`/credentials/${a.id}`} className="inline-flex min-h-10 items-center rounded-lg px-3 text-sm underline">View &amp; share</Link>
                      <ActionButton action={setBadgeVisibility.bind(null, a.id, false)} variant="ghost">Hide</ActionButton>
                    </>
                  ) : (
                    <ActionButton action={setBadgeVisibility.bind(null, a.id, true)} variant="secondary">Show on profile</ActionButton>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
