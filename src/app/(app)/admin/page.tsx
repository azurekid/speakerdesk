import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Badge, Card, formatDate, Skeleton } from "@/components/ui";
import { summarizeBudget } from "@/lib/budget";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/dal";
import { mailConfigured } from "@/lib/mailer";

export const metadata: Metadata = { title: "Admin" };

export default function AdminOverviewPage() {
  return (
    <Suspense fallback={<Skeleton rows={4} />}>
      <Overview />
    </Suspense>
  );
}

function Stat({ label, value, hint, href }: { label: string; value: string | number; hint?: string; href?: string }) {
  const body = (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <p className="text-xs text-ink-soft">{label}</p>
      <p className="mt-1 text-3xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="text-xs text-ink-soft">{hint}</p>}
    </div>
  );
  return href ? <Link href={href} className="block hover:opacity-80">{body}</Link> : body;
}

function daysAgo(n: number) {
  return new Date(Date.now() - n * 86_400_000);
}

async function Overview() {
  await requireAdmin();
  await connection();
  const weekAgo = daysAgo(7);
  const [users, newUsers, admins, banned, unverified, notOnboarded, byRole, events, openCfps, proposals, deals, emails, failedEmails, recentUsers, recentAudit] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.user.count({ where: { role: "admin" } }),
    prisma.user.count({ where: { banned: true } }),
    prisma.user.count({ where: { emailVerified: false } }),
    prisma.user.count({ where: { onboardedAt: null } }),
    prisma.user.groupBy({ by: ["primaryRole"], _count: true }),
    prisma.event.count(),
    prisma.event.count({ where: { cfpPublished: true } }),
    prisma.proposal.count({ where: { withdrawn: false } }),
    prisma.sponsorship.findMany({ select: { status: true, items: { select: { price: true } } } }),
    prisma.outboundEmail.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.outboundEmail.count({ where: { status: "FAILED" } }),
    prisma.user.findMany({ orderBy: { createdAt: "desc" }, take: 6, select: { id: true, name: true, email: true, createdAt: true, primaryRole: true } }),
    prisma.adminAuditLog.findMany({ orderBy: { createdAt: "desc" }, take: 6, include: { actor: { select: { name: true } } } }),
  ]);
  const roleCount = (r: string) => byRole.find((x) => x.primaryRole === r)?._count ?? 0;
  const sponsorship = summarizeBudget(null, 0, deals);

  return (
    <div className="space-y-8">
      {!mailConfigured() && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          <span className="font-semibold">No mail service configured.</span> Sign-in codes, verification and reset codes are only recorded in the{" "}
          <Link href="/admin/outbox" className="underline">email outbox</Link>. Set <code>AZURE_COMMUNICATION_CONNECTION_STRING</code> and <code>EMAIL_FROM</code> before going live.
        </div>
      )}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Users" value={users} hint={`+${newUsers} this week`} href="/admin/users" />
        <Stat label="Events" value={events} hint={`${openCfps} with a published CfP`} href="/admin/events" />
        <Stat label="Proposals" value={proposals} />
        <Stat label="Sponsorship secured" value={new Intl.NumberFormat("en", { notation: "compact" }).format(sponsorship.secured)} hint="across all events, mixed currencies" />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Speakers / organizers / sponsors" value={`${roleCount("SPEAKER")} / ${roleCount("ORGANIZER")} / ${roleCount("SPONSOR")}`} />
        <Stat label="Not onboarded" value={notOnboarded} href="/admin/users?filter=onboarding" />
        <Stat label="Unverified email" value={unverified} href="/admin/users?filter=unverified" />
        <Stat label="Banned / admins" value={`${banned} / ${admins}`} href="/admin/users?filter=banned" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Newest users" actions={<Link href="/admin/users" className="text-sm text-ink-soft hover:text-ink">All users →</Link>}>
          <ul className="divide-y divide-line text-sm">
            {recentUsers.map((u) => (
              <li key={u.id} className="flex items-center justify-between gap-3 py-2.5">
                <Link href={`/admin/users/${u.id}`} className="min-w-0 hover:text-brand-700"><span className="font-medium">{u.name}</span> <span className="text-ink-soft">{u.email}</span></Link>
                <span className="shrink-0 text-xs text-ink-soft">{formatDate(u.createdAt)}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Recent admin activity" description={`${emails} emails this week${failedEmails ? ` · ${failedEmails} failed` : ""}`} actions={<Link href="/admin/audit" className="text-sm text-ink-soft hover:text-ink">Audit log →</Link>}>
          {recentAudit.length === 0 ? (
            <p className="text-sm text-ink-soft">Nothing yet.</p>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {recentAudit.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="min-w-0 truncate"><Badge>{a.action}</Badge> <span className="text-ink-soft">{a.summary}</span></span>
                  <span className="shrink-0 text-xs text-ink-soft">{a.actor?.name ?? "—"}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
