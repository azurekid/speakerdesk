import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { Logo, Skeleton } from "@/components/ui";
import { VerifyEmailForm } from "@/components/verify-email-form";
import { getCurrentUser } from "@/lib/dal";
import { mailConfigured } from "@/lib/mailer";

export const metadata: Metadata = { title: "Confirm your email", robots: { index: false, follow: false } };

/** Signed-in accounts whose email isn't confirmed yet land here (see requireUser). */
export default function VerifyEmailPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-10 block"><Logo /></Link>
        <h1 className="text-3xl font-semibold tracking-tight">Confirm your email</h1>
        <Suspense fallback={<Skeleton rows={2} />}>
          <Gate />
        </Suspense>
      </div>
    </main>
  );
}

async function Gate() {
  await connection();
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  if (user.emailVerified || user.impersonatedBy) redirect("/api/account/continue");
  return <VerifyEmailForm email={user.email} devMailHint={!mailConfigured() && process.env.NODE_ENV !== "production"} />;
}
