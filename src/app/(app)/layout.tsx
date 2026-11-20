import { ArrowLeftRight, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { NavLinks, NavList, SignOutButton, StopImpersonating } from "@/components/nav";
import { OnboardingBanner } from "@/components/onboarding-banner";
import { prisma } from "@/lib/db";
import { getOnboarding } from "@/lib/onboarding";
import { ThemeToggle } from "@/components/theme-toggle";
import { Logo } from "@/components/ui";
import { getOrCreateProfile, getPrimaryRole, requireUser } from "@/lib/dal";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="min-h-screen md:flex">
      <aside className="border-b border-line bg-surface md:sticky md:top-0 md:flex md:h-screen md:w-60 md:flex-col md:border-b-0 md:border-r">
        <Suspense fallback={<SidebarBody />}>
          <RoleAwareSidebar />
        </Suspense>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-8 sm:px-10 sm:py-10">
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

/** Static fallback while the session streams in. */
function SidebarBody({ nav, footer, home = "/dashboard" }: { nav?: React.ReactNode; footer?: React.ReactNode; home?: string }) {
  return (
    <>
      <div className="flex items-center justify-between px-5 py-5"><Link href={home}><Logo /></Link><ThemeToggle /></div>
      <div className="px-3 pb-3 md:flex-1 md:overflow-y-auto">{nav ?? <NavList />}</div>
      <div className="hidden border-t border-line p-4 md:block">{footer ?? <div className="h-10 animate-pulse rounded-lg bg-neutral-100" />}</div>
    </>
  );
}

/** Impersonation warning and the onboarding nudge. */
async function Notices() {
  const user = await requireUser();
  const [o, admin] = await Promise.all([
    getOnboarding(user.id),
    user.impersonatedBy ? prisma.user.findUnique({ where: { id: user.impersonatedBy }, select: { name: true } }) : null,
  ]);
  return (
    <>
      {user.impersonatedBy && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-amber-400 px-5 py-3 text-sm text-black">
          <span><span className="font-semibold">Support mode:</span> {admin?.name ?? "An admin"} is viewing SpeakerDesk as {user.name}.</span>
          <StopImpersonating />
        </div>
      )}
      {!o.onboardedAt && !o.requiredDone && <OnboardingBanner left={o.requiredLeft} total={o.steps.length} done={o.done} />}
    </>
  );
}

async function RoleAwareSidebar() {
  const user = await requireUser();
  const [profile, role] = await Promise.all([getOrCreateProfile(user), getPrimaryRole(user.id)]);
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
          <div className="space-y-0.5">
            {others.map((r) => (
              <a key={r} href={`/api/account/view?role=${r.toLowerCase()}&next=${HOME[r]}`} className="flex items-center gap-2 rounded-lg px-2 py-1 text-xs text-ink-soft hover:bg-neutral-100 hover:text-ink">
                <ArrowLeftRight className="size-3.5" />
                {r === "SPEAKER" ? "Speaker" : r === "ORGANIZER" ? "Organizer" : "Sponsor"} view
              </a>
            ))}
          </div>
          <div className="flex items-center gap-3">
            {profile.headshotSquareUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- arbitrary CDN hosts
              <img src={profile.headshotSquareUrl} alt="" className="size-9 rounded-full object-cover" />
            ) : (
              <span className="grid size-9 place-items-center rounded-full bg-ink text-xs font-semibold text-paper">{initials}</span>
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink">{name}</p>
              <p className="text-xs text-ink-soft">
                {{ SPEAKER: "Speaker", ORGANIZER: "Organizer", SPONSOR: "Sponsor" }[role]} · <Link href="/account" className="hover:text-ink hover:underline">Account</Link> · <SignOutButton />
              </p>
              {user.isAdmin && <Link href="/admin" className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline"><ShieldCheck className="size-3.5" />Admin</Link>}
            </div>
          </div>
        </div>
      }
    />
  );
}
