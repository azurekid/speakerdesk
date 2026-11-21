import Link from "next/link";
import { PublicHeader } from "@/components/public-header";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <PublicHeader />
      <main className="mx-auto max-w-3xl px-6 py-12">{children}</main>
      <footer className="mx-auto flex max-w-3xl gap-5 px-6 pb-12 text-sm text-ink-soft">
        <Link href="/whats-new" className="hover:text-ink">What&apos;s new</Link>
        <Link href="/terms" className="hover:text-ink">Terms of use</Link>
        <Link href="/privacy" className="hover:text-ink">Privacy notice</Link>
      </footer>
    </div>
  );
}
