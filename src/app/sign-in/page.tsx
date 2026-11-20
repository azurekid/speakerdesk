import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { SignInForm } from "@/components/sign-in-form";
import { Logo, Skeleton } from "@/components/ui";
import { emailPasswordEnabled, enabledSocialProviders } from "@/lib/auth-providers";
import { mailConfigured } from "@/lib/mailer";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <main className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <section className="relative isolate hidden flex-col justify-between overflow-hidden p-12 text-white lg:flex">
        <Image src="/images/events/microphone.jpg" alt="A microphone on stage with the audience out of focus" fill priority sizes="55vw" className="-z-10 object-cover" />
        <div className="photo-scrim absolute inset-0 -z-10" />
        <Link href="/"><Logo light /></Link>
        <div className="max-w-md">
          <p className="text-4xl font-semibold leading-tight tracking-tight">One desk for everyone who makes an event happen.</p>
          <p className="mt-4 text-white/75">Speakers, organizers and sponsors — one account, and you can switch between them any time.</p>
        </div>
      </section>
      <section className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <Link href="/" className="mb-10 block lg:hidden"><Logo /></Link>
          <h1 className="text-3xl font-semibold tracking-tight">Sign in</h1>
          <p className="mb-8 mt-2 text-sm text-ink-soft">Welcome back — or create your account in seconds.</p>
          <Suspense fallback={<Skeleton rows={2} />}>
            <Methods />
          </Suspense>
        </div>
      </section>
    </main>
  );
}

async function Methods() {
  // Provider config comes from runtime env (App Service settings), not build-time.
  await connection();
  return (
    <SignInForm
      providers={enabledSocialProviders()}
      emailPassword={emailPasswordEnabled()}
      devMailHint={!mailConfigured() && process.env.NODE_ENV !== "production"}
    />
  );
}
