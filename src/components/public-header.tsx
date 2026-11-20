import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { Logo } from "@/components/ui";

export function PublicHeader() {
  return (
    <header className="border-b border-line bg-paper/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/"><Logo /></Link>
        <nav className="flex items-center gap-5 text-sm">
          <Link href="/events" className="text-ink-soft hover:text-ink">Open calls</Link>
          <Link href="/speakers" className="text-ink-soft hover:text-ink">Speakers</Link>
          <ThemeToggle />
          <Link href="/api/account/continue" className="rounded-lg bg-ink px-3.5 py-2 font-medium text-paper">Sign in</Link>
        </nav>
      </div>
    </header>
  );
}
