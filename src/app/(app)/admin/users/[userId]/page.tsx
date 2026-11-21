import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BanForm, ChangeEmailForm, DeleteUserForm, ImpersonateButton, SendResetCodeButton, SetPasswordForm } from "@/components/admin/admin-controls";
import { ActionButton } from "@/components/form-controls";
import { Badge, Card, formatDate, Skeleton } from "@/components/ui";
import { adminResetOnboarding, adminRevokeSessions, adminSetRole, adminSetVerified, adminUnban } from "@/lib/actions/admin";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/dal";
import { ROLE_LABELS } from "@/lib/permissions";

export const metadata: Metadata = { title: "User · Admin" };

type Props = PageProps<"/admin/users/[userId]">;

export default function UserPage(props: Props) {
  return (
    <Suspense fallback={<Skeleton rows={6} />}>
      <UserDetail params={props.params} />
    </Suspense>
  );
}

async function UserDetail({ params }: { params: Props["params"] }) {
  const me = await requireAdmin();
  const { userId } = await params;
  const u = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      profile: true,
      accounts: { select: { providerId: true, password: true } },
      sessions: { where: { expiresAt: { gt: new Date() } }, orderBy: { updatedAt: "desc" } },
      eventMemberships: { include: { event: { select: { id: true, name: true } } } },
      sponsorOrg: { select: { name: true } },
      _count: { select: { talks: true, proposals: true, submissions: true } },
    },
  });
  if (!u) notFound();
  const [emails, audit] = await Promise.all([
    prisma.outboundEmail.findMany({ where: { to: u.email }, orderBy: { createdAt: "desc" }, take: 5 }),
    prisma.auditLog.findMany({ where: { OR: [{ targetType: "user", targetId: u.id }, { actorId: u.id }] }, orderBy: { createdAt: "desc" }, take: 12, include: { actor: { select: { name: true } } } }),
  ]);
  const self = u.id === me.id;
  const hasPassword = u.accounts.some((a) => a.providerId === "credential" && a.password);
  const p = u.profile;

  return (
    <div className="space-y-6">
      <Link href="/admin/users" className="text-sm text-ink-soft hover:text-ink">← All users</Link>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">{u.name}</h2>
          <p className="text-ink-soft">{u.email}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {u.role === "admin" && <Badge className="bg-ink text-paper ring-ink">Platform admin</Badge>}
            {u.banned && <Badge className="bg-rose-50 text-rose-800 ring-rose-200">Banned{u.banExpires ? ` until ${formatDate(u.banExpires)}` : ""}</Badge>}
            <Badge className={u.emailVerified ? "bg-emerald-50 text-emerald-800 ring-emerald-200" : "bg-amber-50 text-amber-800 ring-amber-200"}>{u.emailVerified ? "Email verified" : "Email unverified"}</Badge>
            <Badge>{u.onboardedAt ? `Onboarded ${formatDate(u.onboardedAt)}` : "Onboarding not finished"}</Badge>
            <Badge>Joined {formatDate(u.createdAt)}</Badge>
          </div>
        </div>
        {!self && !u.banned && <ImpersonateButton userId={u.id} name={u.name} />}
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Profile">
          <dl className="grid grid-cols-[120px_1fr] gap-y-1.5 text-sm">
            <dt className="text-ink-soft">Main role</dt><dd>{{ SPEAKER: "Speaker", ORGANIZER: "Organizer", SPONSOR: "Sponsor" }[u.primaryRole]}</dd>
            <dt className="text-ink-soft">Location</dt><dd>{[p?.city, p?.country].filter(Boolean).join(", ") || "-"}{p?.timezone && ` · ${p.timezone}`}</dd>
            <dt className="text-ink-soft">Work</dt><dd>{[p?.jobTitle, p?.company].filter(Boolean).join(" at ") || "-"}</dd>
            <dt className="text-ink-soft">Sign-in</dt><dd>{[hasPassword && "Password", ...u.accounts.filter((a) => a.providerId !== "credential").map((a) => a.providerId), "Email code"].filter(Boolean).join(", ")}</dd>
            <dt className="text-ink-soft">Content</dt><dd>{u._count.talks} talks · {u._count.proposals} proposals · {u._count.submissions} tracked submissions</dd>
            {u.sponsorOrg && <><dt className="text-ink-soft">Sponsor</dt><dd>{u.sponsorOrg.name}</dd></>}
            {p?.publicProfile && p.slug && <><dt className="text-ink-soft">Public page</dt><dd><Link href={`/speakers/${p.slug}`} className="underline">/speakers/{p.slug}</Link></dd></>}
          </dl>
        </Card>
        <Card title="Event teams">
          {u.eventMemberships.length === 0 ? <p className="text-sm text-ink-soft">Not on any event team.</p> : (
            <ul className="space-y-1.5 text-sm">
              {u.eventMemberships.map((m) => <li key={m.id} className="flex justify-between gap-2"><span>{m.event.name}</span><span className="text-ink-soft">{ROLE_LABELS[m.role]}</span></li>)}
            </ul>
          )}
        </Card>
      </div>

      <Card title="Password & sign-in" description={hasPassword ? "The user has a password." : "No password yet. They sign in with a code or social login."}>
        <div className="space-y-6">
          <div>
            <p className="mb-2 text-sm font-medium">Let them reset it themselves</p>
            <SendResetCodeButton userId={u.id} />
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">Set a temporary password</p>
            <SetPasswordForm userId={u.id} />
          </div>
          <div className="flex flex-wrap gap-2 border-t border-line pt-5">
            <ActionButton action={adminRevokeSessions.bind(null, u.id)} confirmText={`Sign ${u.name} out on every device?`}>Sign out everywhere ({u.sessions.length})</ActionButton>
            <ActionButton action={adminSetVerified.bind(null, u.id, !u.emailVerified)}>{u.emailVerified ? "Mark email unverified" : "Mark email verified"}</ActionButton>
            {u.onboardedAt && <ActionButton action={adminResetOnboarding.bind(null, u.id)}>Restart onboarding</ActionButton>}
          </div>
        </div>
      </Card>

      <Card title="Email address">
        <ChangeEmailForm userId={u.id} email={u.email} />
      </Card>

      <Card title="Access">
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            {u.role === "admin" ? (
              <ActionButton action={adminSetRole.bind(null, u.id, "user")} confirmText={`Remove platform admin rights from ${u.name}?`}>Remove admin rights</ActionButton>
            ) : (
              <ActionButton action={adminSetRole.bind(null, u.id, "admin")} confirmText={`Make ${u.name} a platform admin? They'll get full access to this admin area.`}>Make platform admin</ActionButton>
            )}
          </div>
          {!self && (u.banned ? (
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span>Banned: {u.banReason ?? "no reason given"}</span>
              <ActionButton action={adminUnban.bind(null, u.id)}>Lift ban</ActionButton>
            </div>
          ) : (
            <BanForm userId={u.id} />
          ))}
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Recent emails">
          {emails.length === 0 ? <p className="text-sm text-ink-soft">None.</p> : (
            <ul className="divide-y divide-line text-sm">
              {emails.map((m) => <li key={m.id} className="flex justify-between gap-3 py-2"><span className="truncate">{m.subject}</span><span className="shrink-0 text-xs text-ink-soft">{m.status.toLowerCase()} · {formatDate(m.createdAt)}</span></li>)}
            </ul>
          )}
        </Card>
        <Card title="Recent activity" actions={<Link href={`/admin/audit?user=${u.id}`} className="text-sm text-ink-soft hover:text-ink">Full history →</Link>}>
          {audit.length === 0 ? <p className="text-sm text-ink-soft">No activity in the last 90 days.</p> : (
            <ul className="divide-y divide-line text-sm">
              {audit.map((a) => (
                <li key={a.id} className="flex justify-between gap-3 py-2">
                  <span><Badge className={a.outcome === "failure" ? "bg-rose-50 text-rose-800 ring-rose-200" : undefined}>{a.action}</Badge></span>
                  <span className="text-xs text-ink-soft">{a.actor?.name ?? (a.actorEmail || "-")} · {formatDate(a.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {!self && <DeleteUserForm userId={u.id} email={u.email} />}
    </div>
  );
}
