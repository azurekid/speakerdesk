import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EventCard } from "@/components/events/event-card";
import { ButtonLink, cx, dateParts, Eyebrow, formatDate, PhotoBanner, Skeleton, StatusBadge } from "@/components/ui";
import { prisma } from "@/lib/db";
import { getOrCreateProfile, requireUser } from "@/lib/dal";
import { PLATFORM_LABELS } from "@/lib/domain";
import { getOpenCalls } from "@/lib/public-events";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <Suspense fallback={<Skeleton rows={4} />}>
      <Overview />
    </Suspense>
  );
}

const PROFILE_FIELDS = ["fullName", "tagline", "bioShort", "bioMedium", "bioLong", "headshotSquareUrl", "city", "country", "linkedinUrl"] as const;

function whenLabel(days: number) {
  if (days <= 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days} days`;
}

function Stat({ label, value, hint, href }: { label: string; value: string | number; hint?: string; href?: string }) {
  const body = (
    <div className="h-full border-l border-line py-1 pl-4">
      <p className="text-xs text-ink-soft">{label}</p>
      <p className="font-display tracking-tight text-4xl font-semibold tabular-nums text-ink">{value}</p>
      {hint && <p className="text-xs text-ink-soft">{hint}</p>}
    </div>
  );
  return href ? <Link href={href} className="block hover:opacity-75">{body}</Link> : body;
}

async function Overview() {
  const user = await requireUser();
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const [profile, talkCount, statusCounts, deadlines, upcoming, openCalls] = await Promise.all([
    getOrCreateProfile(user),
    prisma.talk.count({ where: { userId: user.id, archived: false } }),
    prisma.submission.groupBy({ by: ["status"], where: { userId: user.id }, _count: true }),
    prisma.submission.findMany({
      where: { userId: user.id, status: "DRAFT", cfpDeadline: { gte: today } },
      orderBy: { cfpDeadline: "asc" },
      take: 5,
      include: { talk: { select: { title: true } } },
    }),
    prisma.submission.findMany({
      where: { userId: user.id, status: "ACCEPTED", eventStart: { gte: today } },
      orderBy: { eventStart: "asc" },
      take: 4,
      include: { talk: { select: { title: true } } },
    }),
    getOpenCalls(3),
  ]);
  const invitations = await prisma.speakerInvitation.findMany({ where: { speakerId: user.id, status: "PENDING" }, include: { event: { select: { name: true } } } });
  const toConfirm = await prisma.proposal.findMany({
    where: { speakerId: user.id, decision: "ACCEPTED", decisionPublished: true, withdrawn: false, confirmation: "PENDING" },
    select: { id: true, title: true, submissionId: true, event: { select: { name: true } } },
  });

  const count = (s: string) => statusCounts.find((c) => c.status === s)?._count ?? 0;
  const accepted = count("ACCEPTED");
  const decided = accepted + count("REJECTED") + count("WAITLISTED");
  const pending = count("SUBMITTED");
  const filled = PROFILE_FIELDS.filter((f) => profile[f].trim() !== "").length;
  const completeness = Math.round((filled / PROFILE_FIELDS.length) * 100);
  const daysUntil = (d: Date) => Math.ceil((d.getTime() - today.getTime()) / 86_400_000);
  const firstName = (profile.fullName || user.name).split(" ")[0];
  const next = upcoming[0];

  return (
    <div className="space-y-12">
      <PhotoBanner src="/images/events/speaker-screen.jpg" priority>
        <div className="flex min-h-[260px] flex-wrap items-end justify-between gap-6 p-8 sm:p-10">
          <div>
            <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">Good to see you, {firstName}.</h1>
            <p className="mt-2 max-w-lg text-white/85">
              {next
                ? <>Next up: <strong className="font-semibold text-white">{next.eventName}</strong> {whenLabel(daysUntil(next.eventStart!))}{next.talk ? <> with “{next.talk.title}”</> : null}.</>
                : "No talks on the calendar yet. Find an open call below."}
            </p>
          </div>
          <div className="flex gap-2">
            <ButtonLink href="/sessions/new" variant="light">New session</ButtonLink>
            <ButtonLink href="/submissions/new" variant="accent">Track submission</ButtonLink>
          </div>
        </div>
      </PhotoBanner>

      {invitations.length > 0 && (
        <Link href="/invitations" className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-brand-200 bg-brand-50 px-5 py-4 hover:border-brand-500">
          <p className="text-sm">
            <span className="font-semibold text-brand-700">You&apos;re invited to speak</span>{" "}
            <span className="text-ink-soft">at {invitations.map((i) => i.event.name).join(", ")}</span>
          </p>
          <span className="text-sm font-medium">Respond →</span>
        </Link>
      )}

      {toConfirm.map((p) => (
        <Link key={p.id} href={p.submissionId ? `/submissions/${p.submissionId}/edit#confirm` : "/submissions"} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 hover:border-emerald-500">
          <p className="text-sm">
            <span className="font-semibold text-emerald-800">Accepted: “{p.title}”</span>{" "}
            <span className="text-ink-soft">at {p.event.name}. Please confirm you&apos;ll be there.</span>
          </p>
          <span className="text-sm font-medium">Confirm →</span>
        </Link>
      ))}

      <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
        <Stat label="Active sessions" value={talkCount} href="/sessions" />
        <Stat label="Awaiting decision" value={pending} href="/submissions?status=SUBMITTED" />
        <Stat label="Accepted" value={accepted} href="/submissions?status=ACCEPTED" />
        <Stat label="Acceptance rate" value={decided ? `${Math.round((accepted / decided) * 100)}%` : "-"} hint={decided ? `${accepted} of ${decided} decided` : "No decisions yet"} />
      </div>

      {completeness < 100 && (
        <div className="flex flex-wrap items-center gap-6 rounded-xl border border-line bg-surface px-5 py-4">
          <div className="min-w-48 flex-1">
            <p className="text-sm font-medium">Your speaker profile is {completeness}% complete</p>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-neutral-100">
              <div className="h-full rounded-full bg-brand-600" style={{ width: `${completeness}%` }} />
            </div>
          </div>
          <ButtonLink href="/profile" variant="secondary" size="sm">Complete profile</ButtonLink>
        </div>
      )}

      <div className="grid gap-10 lg:grid-cols-2">
        <section>
          <SectionTitle title="Upcoming talks" href="/submissions?status=ACCEPTED" link="All accepted" />
          {upcoming.length === 0 ? (
            <p className="rounded-lg border border-dashed border-line px-5 py-8 text-center text-sm text-ink-soft">No accepted talks scheduled yet.</p>
          ) : (
            <ul className="divide-y divide-line border-y border-line">
              {upcoming.map((s) => {
                const d = dateParts(s.eventStart!);
                return (
                  <li key={s.id}>
                    <Link href={`/submissions/${s.id}/edit`} className="flex items-center gap-5 py-4 hover:bg-surface/60">
                      <div className="w-14 shrink-0 text-center">
                        <p className="text-[11px] font-semibold tracking-[0.15em] text-brand-600">{d.month}</p>
                        <p className="font-display tracking-tight text-3xl font-semibold leading-none">{d.day}</p>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-display tracking-tight text-lg font-semibold">{s.eventName}</p>
                        <p className="truncate text-sm text-ink-soft">{s.talk?.title ?? "Session to be confirmed"} · {s.location || PLATFORM_LABELS[s.platform]}</p>
                      </div>
                      <StatusBadge status={s.status} />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section>
          <SectionTitle title="CfP deadlines" href="/submissions?status=DRAFT" link="All drafts" />
          {deadlines.length === 0 ? (
            <p className="rounded-lg border border-dashed border-line px-5 py-8 text-center text-sm text-ink-soft">
              Nothing due. <Link href="/submissions/new" className="font-medium text-ink underline">Track a CfP</Link>
            </p>
          ) : (
            <ul className="divide-y divide-line border-y border-line">
              {deadlines.map((s) => {
                const days = daysUntil(s.cfpDeadline!);
                return (
                  <li key={s.id}>
                    <Link href={`/submissions/${s.id}/edit`} className="flex items-center gap-4 py-4 hover:bg-surface/60">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{s.eventName}</p>
                        <p className="truncate text-sm text-ink-soft">{s.talk?.title ?? "No session linked"}</p>
                      </div>
                      <div className="text-right">
                        <p className={cx("font-display tracking-tight text-xl font-semibold tabular-nums leading-none", days <= 7 && "text-brand-600")}>{days === 0 ? "Today" : `${days}d`}</p>
                        <p className="text-[11px] text-ink-soft">{formatDate(s.cfpDeadline)}</p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {openCalls.length > 0 && (
        <section>
          <div className="mb-4 flex items-end justify-between">
            <div>
              <Eyebrow>On SpeakerDesk</Eyebrow>
              <h2 className="mt-1 font-display tracking-tight text-2xl font-semibold">Open calls for papers</h2>
            </div>
            <Link href="/events" className="inline-flex items-center gap-1 text-sm text-ink-soft hover:text-ink">Browse all <ArrowRight className="size-4" /></Link>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {openCalls.map((e) => <EventCard key={e.id} event={e} />)}
          </div>
        </section>
      )}
    </div>
  );
}

function SectionTitle({ title, href, link }: { title: string; href: string; link: string }) {
  return (
    <div className="mb-3 flex items-end justify-between">
      <h2 className="font-display tracking-tight text-2xl font-semibold">{title}</h2>
      <Link href={href} className="text-sm text-ink-soft hover:text-ink">{link} →</Link>
    </div>
  );
}
