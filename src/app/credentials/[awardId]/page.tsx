import { BadgeCheck, Download } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BadgeMedal } from "@/components/badge-medal";
import { ShareButtons } from "@/components/share";
import { formatDate, Skeleton } from "@/components/ui";
import { appUrl } from "@/lib/app-url";
import { prisma } from "@/lib/db";

type Props = PageProps<"/credentials/[awardId]">;

/** Only accepted badges the recipient chose to show are public. Everything else is a 404. */
async function loadCredential(awardId: string) {
  const a = await prisma.badgeAward.findUnique({
    where: { id: awardId },
    include: {
      badge: true,
      event: { select: { name: true, slug: true, startDate: true, cfpPublished: true, programPublished: true } },
      recipient: { select: { name: true, profile: { select: { fullName: true, publicProfile: true, slug: true, headshotSquareUrl: true } } } },
    },
  });
  if (!a || a.status !== "ACCEPTED" || !a.showOnProfile) return null;
  return a;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { awardId } = await params;
  const a = await loadCredential(awardId);
  if (!a) return { title: "Badge" };
  const who = a.recipient.profile?.fullName || a.recipient.name;
  const title = `${who} earned “${a.badge.name}” at ${a.event.name}`;
  const description = a.badge.description || `A SpeakerDesk badge from ${a.event.name}.`;
  return {
    title: `${a.badge.name} · ${who}`,
    description,
    openGraph: { type: "website", url: `${appUrl()}/credentials/${a.id}`, title, description, siteName: "SpeakerDesk" },
    twitter: { card: "summary", title, description },
  };
}

export default function CredentialPage(props: Props) {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <Suspense fallback={<Skeleton rows={4} />}>
        <Credential params={props.params} />
      </Suspense>
    </main>
  );
}

async function Credential({ params }: { params: Props["params"] }) {
  const { awardId } = await params;
  const a = await loadCredential(awardId);
  if (!a) notFound();
  const who = a.recipient.profile?.fullName || a.recipient.name;
  const profile = a.recipient.profile;
  const eventPublic = a.event.cfpPublished || a.event.programPublished;

  return (
    <article className="rounded-2xl border border-line bg-surface p-6 text-center sm:p-10">
      <BadgeMedal icon={a.badge.icon} color={a.badge.color} size="xl" label={a.badge.name} eventName={a.event.name} date={a.event.startDate} className="mx-auto" />
      <h1 className="mt-6 text-3xl font-semibold tracking-tight">{a.badge.name}</h1>
      {a.badge.description && <p className="mx-auto mt-2 max-w-md text-ink-soft">{a.badge.description}</p>}
      <p className="mt-6 text-lg">
        Awarded to{" "}
        {profile?.publicProfile && profile.slug ? <Link href={`/speakers/${profile.slug}`} className="font-semibold underline">{who}</Link> : <span className="font-semibold">{who}</span>}
      </p>
      <p className="text-ink-soft">
        by {eventPublic ? <Link href={`/events/${a.event.slug}`} className="underline">{a.event.name}</Link> : a.event.name} on {formatDate(a.respondedAt ?? a.createdAt)}
      </p>
      {a.message && <blockquote className="mx-auto mt-6 max-w-md border-l-2 border-line pl-4 text-left italic text-ink-soft">“{a.message}”</blockquote>}
      <p className="mt-8 inline-flex items-center gap-1.5 text-xs text-ink-soft">
        <BadgeCheck className="size-4 text-emerald-600" />Issued on SpeakerDesk by the organizers of {a.event.name} and accepted by {who.split(" ")[0]}.
      </p>
      <p className="mt-4">
        <a href={`/credentials/${a.id}/badge.svg`} download={`${a.badge.name.replace(/[^\w-]+/g, "-").toLowerCase()}-badge.svg`} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-line px-3 text-sm hover:border-neutral-400">
          <Download className="size-4" />Download badge (SVG)
        </a>
      </p>
      <ShareButtons
        className="mt-6 border-t border-line pt-6 text-left"
        title="Share this badge"
        url={`${appUrl()}/credentials/${a.id}`}
        text={`I earned the “${a.badge.name}” badge at ${a.event.name} 🎉`}
        subject={`${a.badge.name} — ${a.event.name}`}
      />
    </article>
  );
}
