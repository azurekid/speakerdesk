"use client";

import {
  Building2, CalendarCheck, Download, Handshake, LayoutDashboard, LogOut, type LucideIcon, Megaphone, Presentation, Store, Ticket, Upload, UserRound, Users, Mail, Search,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cx } from "@/components/ui";
import { authClient } from "@/lib/auth-client";

type Section = { title: string; links: { href: string; label: string; icon: LucideIcon }[] };

const SPEAKER: Section = {
    title: "Speaker",
    links: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/profile", label: "Profile", icon: UserRound },
      { href: "/sessions", label: "Sessions", icon: Presentation },
      { href: "/submissions", label: "Submissions", icon: CalendarCheck },
      { href: "/invitations", label: "Invitations", icon: Mail },
      { href: "/events", label: "Open calls", icon: Megaphone },
    ],
};
const ORGANIZER: Section = {
    title: "Organizer",
    links: [
      { href: "/organize", label: "My events", icon: Ticket },
      { href: "/organize/people", label: "People", icon: Users },
      { href: "/speakers", label: "Find speakers", icon: Search },
    ],
};
const DATA: Section = {
    title: "Data",
    links: [
      { href: "/import", label: "Import", icon: Download },
      { href: "/export", label: "Export", icon: Upload },
    ],
};

const SPONSOR: Section = {
  title: "Sponsor",
  links: [
    { href: "/sponsor", label: "Opportunities", icon: Store },
    { href: "/sponsor/deals", label: "My sponsorships", icon: Handshake },
    { href: "/sponsor/company", label: "Company profile", icon: Building2 },
  ],
};

export type NavRole = "SPEAKER" | "ORGANIZER" | "SPONSOR";
const sectionsFor = (role: NavRole) =>
  role === "ORGANIZER" ? [ORGANIZER, SPEAKER, DATA] : role === "SPONSOR" ? [SPONSOR, SPEAKER, ORGANIZER, DATA] : [SPEAKER, ORGANIZER, DATA];

/** Highlights the current section. Must sit inside <Suspense> (reads the URL). */
export function NavLinks({ role }: { role: NavRole }) {
  return <NavList pathname={usePathname()} role={role} />;
}

/** Plain list without an active state — the Suspense fallback for NavLinks. */
export function NavList({ pathname = "", role = "SPEAKER" }: { pathname?: string; role?: NavRole }) {
  return (
    <nav className="flex flex-col gap-6">
      {sectionsFor(role).map((section) => (
        <div key={section.title} className="flex flex-col gap-0.5">
          <p className="mb-1 px-3 text-xs font-medium text-neutral-400">{section.title}</p>
          {section.links.map(({ href, label, icon: Icon }) => {
            const active = href === "/organize" ? pathname === href || /^\/organize\/(?!people)/.test(pathname) : href === "/sponsor" ? pathname === href || /^\/sponsor\/(?!deals|company)/.test(pathname) : pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                className={cx(
                  "relative flex items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2.5 text-[15px] transition-colors md:py-2 md:text-sm",
                  active ? "bg-neutral-100 font-medium text-ink" : "text-ink-soft hover:bg-neutral-100/70 hover:text-ink",
                )}
              >
                <Icon className={cx("size-4", active ? "text-ink" : "text-neutral-400")} strokeWidth={2} />
                {label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

export function SignOutButton({ className }: { className?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className={className ?? "text-xs text-ink-soft underline-offset-2 hover:text-ink hover:underline"}
      onClick={async () => {
        await authClient.signOut();
        router.replace("/");
        router.refresh();
      }}
    >
      <LogOut className="size-4 md:size-3.5" />
      Sign out
    </button>
  );
}

/** Ends an admin's support session and returns them to their own account. */
export function StopImpersonating() {
  return (
    <button
      type="button"
      className="rounded-lg bg-ink px-3 py-1.5 text-xs font-medium text-paper"
      onClick={async () => {
        await authClient.admin.stopImpersonating();
        // Full reload: the session just changed, so all server components must re-render.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.assign("/admin/users");
      }}
    >
      Stop and return to admin
    </button>
  );
}
