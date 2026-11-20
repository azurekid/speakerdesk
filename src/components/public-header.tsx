import Link from "next/link";
import { AccountButton } from "@/components/account-button";
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
          <AccountButton />
        </nav>
      </div>
    </header>
  );
}
