"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";

const LINKS = [
  { href: "/events", label: "Open calls" },
  { href: "/speakers", label: "Speakers" },
  { href: "/sign-in?next=/organize/new", label: "Run a call for papers" },
  { href: "/whats-new", label: "What's new" },
];

/** The public header's links on phones: a menu button with a dropdown panel. */
export function PublicMenu({ light = false }: { light?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="sm:hidden">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} className={`grid size-11 place-items-center rounded-lg ${light ? "text-white hover:bg-white/10" : "text-ink hover:bg-neutral-100"}`}>
        {open ? <X className="size-6" /> : <Menu className="size-6" />}
      </button>
      {open && (
        <div className="absolute inset-x-0 top-full z-40 border-b border-line bg-surface px-4 pb-4 text-ink shadow-lg" onClick={(e) => (e.target as HTMLElement).closest("a") && setOpen(false)}>
          <nav className="grid">
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="border-b border-line py-3.5 text-[15px] text-ink last:border-b-0">{l.label}</Link>
            ))}
          </nav>
          <div className="mt-2 flex items-center justify-between text-sm text-ink-soft">Theme <ThemeToggle /></div>
        </div>
      )}
    </div>
  );
}
