"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Nudges people who haven't finished onboarding, everywhere except the onboarding page itself. */
export function OnboardingBanner({ left, total, done }: { left: number; total: number; done: number }) {
  const pathname = usePathname();
  if (pathname.startsWith("/onboarding")) return null;
  return (
    <Link href="/onboarding" className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-200 bg-brand-50 px-5 py-3 hover:border-brand-500">
      <span className="text-sm">
        <span className="font-semibold text-brand-700">Finish setting up your account</span>{" "}
        <span className="text-ink-soft">— {left} required step{left === 1 ? "" : "s"} left ({done}/{total} done)</span>
      </span>
      <span className="text-sm font-medium">Continue →</span>
    </Link>
  );
}
