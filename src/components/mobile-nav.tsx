"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { type ReactNode, useEffect, useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Logo } from "@/components/ui";

/**
 * Phone navigation: a sticky top bar with a menu button that opens a full-height drawer
 * holding the same navigation and account links as the desktop sidebar. Hidden from md up.
 */
export function MobileNav({ home, nav, footer }: { home: string; nav: ReactNode; footer?: ReactNode }) {
  const [open, setOpen] = useState(false);

  // While the drawer is open: no page scrolling behind it, and Escape closes it.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="md:hidden">
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-surface/95 px-4 py-2 backdrop-blur">
        <Link href={home} className="py-2"><Logo /></Link>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            aria-expanded={open}
            aria-controls="mobile-menu"
            className="grid size-11 place-items-center rounded-lg text-ink hover:bg-neutral-100"
          >
            <Menu className="size-6" />
          </button>
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Menu" id="mobile-menu">
          <button type="button" aria-label="Close menu" onClick={() => setOpen(false)} className="absolute inset-0 bg-black/40" />
          <div
            className="absolute inset-y-0 right-0 flex w-[86%] max-w-sm flex-col bg-surface shadow-xl"
            // Any link inside closes the drawer, so it never stays open over the next page.
            onClick={(e) => (e.target as HTMLElement).closest("a") && setOpen(false)}
          >
            <div className="flex items-center justify-between border-b border-line px-4 py-2">
              <Logo />
              <button type="button" onClick={() => setOpen(false)} aria-label="Close menu" className="grid size-11 place-items-center rounded-lg hover:bg-neutral-100">
                <X className="size-6" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-4">{nav}</div>
            {footer && <div className="border-t border-line p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{footer}</div>}
          </div>
        </div>
      )}
    </div>
  );
}
