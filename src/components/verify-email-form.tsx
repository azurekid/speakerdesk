"use client";

import { useState } from "react";
import { buttonClass, cx } from "@/components/ui";
import { authClient } from "@/lib/auth-client";

/**
 * Confirms the signed-in account's email with a 6-digit code. Nothing is sent until the person
 * asks, so reloading the page doesn't flood their inbox.
 */
// Full page loads on purpose: the session cookie changes, and /api/account/continue is a route handler.
const CONTINUE = "/api/account/continue";
const SIGN_IN = "/sign-in";
const hardNavigate = (path: string) => window.location.assign(path);

export function VerifyEmailForm({ email, devMailHint }: { email: string; devMailHint: boolean }) {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function run(fn: () => Promise<{ error?: { message?: string } | null }>) {
    setError(null);
    setPending(true);
    try {
      const r = await fn();
      if (r.error) setError(r.error.message ?? "Something went wrong.");
    } finally {
      setPending(false);
    }
  }

  const send = () =>
    run(async () => {
      const r = await authClient.emailOtp.sendVerificationOtp({ email, type: "email-verification" });
      if (!r.error) {
        setSent(true);
        setInfo(`We've sent a 6-digit code to ${email}.`);
      }
      return r;
    });

  const verify = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const otp = String(new FormData(e.currentTarget).get("otp") ?? "").trim();
    return run(async () => {
      const r = await authClient.emailOtp.verifyEmail({ email, otp });
      if (!r.error) hardNavigate(CONTINUE);
      return r;
    });
  };

  const signOut = async () => {
    await authClient.signOut();
    hardNavigate(SIGN_IN);
  };

  const link = "font-medium text-ink underline underline-offset-2 hover:text-brand-700";
  return (
    <div className="mt-2 space-y-5 text-sm">
      <p className="text-ink-soft">
        Before you can use SpeakerDesk we need to check that <strong className="text-ink">{email}</strong> is yours.
      </p>
      {!sent ? (
        <button type="button" onClick={send} disabled={pending} className={cx(buttonClass("primary"), "w-full")}>
          {pending ? "Sending…" : "Email me a code"}
        </button>
      ) : (
        <form onSubmit={verify} className="space-y-4">
          <input name="otp" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required autoFocus
            placeholder="6-digit code" aria-label="6-digit code" className="control text-center font-mono text-lg tracking-[0.5em]" />
          <button type="submit" disabled={pending} className={cx(buttonClass("primary"), "w-full")}>
            {pending ? "Checking…" : "Confirm email"}
          </button>
          <p>Didn&apos;t get it? <button type="button" className={link} onClick={send} disabled={pending}>Send a new code</button></p>
        </form>
      )}
      {devMailHint && sent && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">Development: no mail service is configured, so codes appear in the server log and in Admin → Email outbox.</p>}
      {info && !error && <p role="status" className="text-ink-soft">{info}</p>}
      {error && <p role="alert" className="text-red-700">{error}</p>}
      <p className="text-ink-soft">Wrong address? <button type="button" className={link} onClick={signOut}>Sign out</button></p>
    </div>
  );
}
