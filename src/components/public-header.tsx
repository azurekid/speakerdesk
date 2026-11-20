import Link from "next/link";
import { AccountButton } from "@/components/account-button";
import { PublicMenu } from "@/components/public-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { Logo } from "@/components/ui";

export function PublicHeader() {
  return (
    <header className="relative border-b border-line bg-paper/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
        <Link href="/" className="shrink-0"><Logo /></Link>
        <nav className="flex items-center gap-2 text-sm sm:gap-5">
          <Link href="/events" className="hidden text-ink-soft hover:text-ink sm:inline">Open calls</Link>
          <Link href="/speakers" className="hidden text-ink-soft hover:text-ink sm:inline">Speakers</Link>
          <span className="hidden sm:inline-flex"><ThemeToggle /></span>
          <AccountButton />
          <PublicMenu />
        </nav>
      </div>
    </header>
  );
}
