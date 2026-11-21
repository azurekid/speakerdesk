import { ArrowLeftRight, Award, ShieldCheck, UserCog } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { MobileNav } from "@/components/mobile-nav";
import { NavLinks, NavList, SignOutButton, StopImpersonating } from "@/components/nav";
import { OnboardingBanner } from "@/components/onboarding-banner";
import { acceptCurrentTerms } from "@/lib/actions/onboarding";
import { TERMS_VERSION } from "@/lib/legal";
import { prisma } from "@/lib/db";
import { getOnboarding } from "@/lib/onboarding";
import { ThemeToggle } from "@/components/theme-toggle";
import { Logo } from "@/components/ui";
import { getOrCreateProfile, getPrimaryRole, requireUser } from "@/lib/dal";

import type { Metadata } from "next";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="min-h-screen md:flex">
      <Suspense fallback={<SidebarBody />}>
        <RoleAwareSidebar />
      </Suspense>
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-10 sm:py-10">
        <div className="mx-auto max-w-5xl">
          <Suspense fallback={null}>
            <Notices />
          </Suspense>
          {children}
        </div>
      </main>
    </div>
  );
}

/**
 * Navigation chrome: a top bar + drawer on phones, a sticky sidebar from md up.
 * Without props it's the static fallback shown while the session streams in.
 */
function SidebarBody({ nav, footer, home = "/dashboard" }: { nav?: React.ReactNode; footer?: React.ReactNode; home?: string }) {
  return (
    <>
      <MobileNav home={home} nav={nav ?? <NavList />} footer={footer} />
      <aside className="hidden border-r border-line bg-surface md:sticky md:top-0 md:flex md:h-screen md:w-60 md:shrink-0 md:flex-col">
        <div className="flex items-center justify-between px-5 py-5"><Link href={home}><Logo /></Link><ThemeToggle /></div>
        <div className="flex-1 overflow-y-auto px-3 pb-3">{nav ?? <NavList />}</div>
        <div className="border-t border-line p-4">{footer ?? <div className="h-10 animate-pulse rounded-lg bg-neutral-100" />}</div>
      </aside>
    </>
  );
}

/** Big enough to tap in the phone drawer, compact in the desktop sidebar. */
const FOOTER_ROW = "flex items-center gap-2.5 rounded-lg px-2 py-2.5 text-ink-soft hover:bg-neutral-100 hover:text-ink md:py-1.5";

/** Impersonation warning and the onboarding nudge. */
async function Notices() {
  const user = await requireUser();
  const [o, admin, terms, pendingBadges] = await Promise.all([
    getOnboarding(user.id),
    user.impersonatedBy ? prisma.user.findUnique({ where: { id: user.impersonatedBy }, select: { name: true } }) : null,
    prisma.user.findUnique({ where: { id: user.id }, select: { termsAcceptedAt: true, termsVersion: true } }),
    prisma.badgeAward.count({ where: { recipientId: user.id, status: "PENDING" } }),
  ]);
  const termsOutdated = Boolean(terms?.termsAcceptedAt) && terms?.termsVersion !== TERMS_VERSION;
  return (
    <>
      {user.impersonatedBy && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-amber-400 px-5 py-3 text-sm text-black">
          <span><span className="font-semibold">Support mode:</span> {admin?.name ?? "An admin"} is viewing SpeakerDesk as {user.name}.</span>
          <StopImpersonating />
        </div>
      )}
      {termsOutdated && !user.impersonatedBy && (
        <form action={acceptCurrentTerms} className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-5 py-3 text-sm">
          <span>
            <span className="font-semibold">We&apos;ve updated our terms.</span>{" "}
            Please read the <Link href="/terms" target="_blank" className="underline">terms of use</Link> and the{" "}
            <Link href="/privacy" target="_blank" className="underline">privacy notice</Link>.
          </span>
          <button type="submit" className="rounded-lg bg-ink px-3.5 py-1.5 font-medium text-paper">I agree</button>
        </form>
      )}
      {pendingBadges > 0 && !user.impersonatedBy && (
        <Link href="/badges" className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-5 py-3 text-sm hover:border-neutral-400">
          <span className="inline-flex items-center gap-2"><Award className="size-4 text-brand-600" /><span className="font-semibold">You&apos;ve been given {pendingBadges === 1 ? "a badge" : `${pendingBadges} badges`}.</span> Accept {pendingBadges === 1 ? "it" : "them"} to show {pendingBadges === 1 ? "it" : "them"} on your profile.</span>
          <span className="font-medium">View →</span>
        </Link>
      )}
      {!o.onboardedAt && !o.requiredDone && <OnboardingBanner left={o.requiredLeft} total={o.steps.length} done={o.done} />}
    </>
  );
}

async function RoleAwareSidebar() {
  const user = await requireUser();
  const [profile, role, pendingBadges] = await Promise.all([
    getOrCreateProfile(user),
    getPrimaryRole(user.id),
    prisma.badgeAward.count({ where: { recipientId: user.id, status: "PENDING" } }),
  ]);
  const name = profile.fullName || user.name;
  const initials = name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  const others = (["SPEAKER", "ORGANIZER", "SPONSOR"] as const).filter((r) => r !== role);
  const HOME = { SPEAKER: "/dashboard", ORGANIZER: "/organize", SPONSOR: "/sponsor" } as const;

  return (
    <SidebarBody
      home={HOME[role]}
      nav={
        <Suspense fallback={<NavList role={role} />}>
          <NavLinks role={role} />
        </Suspense>
      }
      footer={
        <div className="space-y-3">
          <div className="flex items-center gap-3 px-2">
            {profile.headshotSquareUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- arbitrary CDN hosts
              <img src={profile.headshotSquareUrl} alt="" className="size-9 rounded-full object-cover" />
            ) : (
              <span className="grid size-9 place-items-center rounded-full bg-ink text-xs font-semibold text-paper">{initials}</span>
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink">{name}</p>
              <p className="text-xs text-ink-soft">{{ SPEAKER: "Speaker", ORGANIZER: "Organizer", SPONSOR: "Sponsor" }[role]} view</p>
            </div>
          </div>
          <div className="grid gap-0.5 text-sm md:text-xs">
            <Link href="/account" className={FOOTER_ROW}><UserCog className="size-4 md:size-3.5" />Account</Link>
            <Link href="/badges" className={FOOTER_ROW}>
              <Award className="size-4 md:size-3.5" />Badges
              {pendingBadges > 0 && <span className="ml-auto rounded-full bg-brand-600 px-1.5 text-[11px] font-semibold text-white">{pendingBadges}</span>}
            </Link>
            {user.isAdmin && <Link href="/admin" className={`${FOOTER_ROW} font-medium text-brand-700`}><ShieldCheck className="size-4 md:size-3.5" />Admin</Link>}
            {others.map((r) => (
              <a key={r} href={`/api/account/view?role=${r.toLowerCase()}&next=${HOME[r]}`} className={FOOTER_ROW}>
                <ArrowLeftRight className="size-4 md:size-3.5" />
                Switch to {r === "SPEAKER" ? "speaker" : r === "ORGANIZER" ? "organizer" : "sponsor"} view
              </a>
            ))}
            <SignOutButton className={FOOTER_ROW} />
          </div>
        </div>
      }
    />
  );
}
