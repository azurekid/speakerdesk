import type { Metadata } from "next";
import { headers } from "next/headers";
import { Suspense } from "react";
import { DeleteAccount, EmailSettings, PasswordSettings, SignOutOthers } from "@/components/account-settings";
import { Badge, Card, formatDate, PageHeader, Skeleton } from "@/components/ui";
import { soleOwnedEvents } from "@/lib/account-deletion";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/dal";
import { mailConfigured } from "@/lib/mailer";

export const metadata: Metadata = { title: "Account" };

const PROVIDER_NAMES: Record<string, string> = { credential: "Email & password", github: "GitHub", google: "Google", linkedin: "LinkedIn", microsoft: "Microsoft" };

function device(ua: string | null) {
  if (!ua) return "Unknown device";
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /Mac OS X/.test(ua) ? "macOS" : /Windows/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Linux/.test(ua) ? "Linux" : "";
  return [browser, os].filter(Boolean).join(" on ");
}

export default function AccountPage() {
  return (
    <>
      <PageHeader eyebrow="Settings" title="Account" description="Sign-in details, security and your data." />
      <Suspense fallback={<Skeleton rows={4} />}>
        <Account />
      </Suspense>
    </>
  );
}

async function Account() {
  const user = await requireUser();
  const [accounts, sessions, current, blockingEvents] = await Promise.all([
    prisma.account.findMany({ where: { userId: user.id }, select: { providerId: true, password: true, createdAt: true } }),
    prisma.session.findMany({ where: { userId: user.id, expiresAt: { gt: new Date() } }, orderBy: { updatedAt: "desc" } }),
    auth.api.getSession({ headers: await headers() }),
    soleOwnedEvents(user.id),
  ]);
  const hasPassword = accounts.some((a) => a.providerId === "credential" && a.password);

  return (
    <div className="space-y-6">
      <EmailSettings email={user.email} verified={user.emailVerified} devMailHint={!mailConfigured() && process.env.NODE_ENV !== "production"} />
      <PasswordSettings hasPassword={hasPassword} />
      <Card title="Ways to sign in">
        <ul className="flex flex-wrap gap-2 text-sm">
          <li><Badge>One-time email code</Badge></li>
          {accounts.map((a) => <li key={a.providerId}><Badge>{PROVIDER_NAMES[a.providerId] ?? a.providerId}</Badge></li>)}
        </ul>
      </Card>
      <Card title="Where you're signed in" actions={sessions.length > 1 ? <SignOutOthers /> : undefined}>
        <ul className="divide-y divide-line text-sm">
          {sessions.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
              <span>
                {device(s.userAgent)}
                {s.id === current?.session.id && <Badge className="ml-2 bg-emerald-50 text-emerald-800 ring-emerald-200">This device</Badge>}
                {s.impersonatedBy && <Badge className="ml-2 bg-amber-50 text-amber-800 ring-amber-200">Admin support session</Badge>}
              </span>
              <span className="text-xs text-ink-soft">Last active {formatDate(s.updatedAt)}{s.ipAddress && ` · ${s.ipAddress}`}</span>
            </li>
          ))}
        </ul>
      </Card>
      {!user.impersonatedBy && <DeleteAccount email={user.email} hasPassword={hasPassword} blockingEvents={blockingEvents} />}
    </div>
  );
}
