import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Account deleted" };

export default function GoodbyePage() {
  return (
    <div className="py-12 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">Your account has been deleted</h1>
      <p className="mx-auto mt-4 max-w-md text-ink-soft">
        Your profile, sessions, proposals and uploaded photos are gone. Backups roll off within 14 days. Thanks for using SpeakerDesk.
      </p>
      <Link href="/" className="mt-8 inline-block underline">Back to the home page</Link>
    </div>
  );
}
