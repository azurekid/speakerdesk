"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { buttonClass, cx } from "@/components/ui";
import { authClient } from "@/lib/auth-client";

type Provider = "github" | "google" | "linkedin" | "microsoft";
type View = "password" | "sign-up" | "code-email" | "code-verify" | "reset-email" | "reset-verify";

const PROVIDER_LABELS: Record<Provider, string> = { github: "GitHub", google: "Google", linkedin: "LinkedIn", microsoft: "Microsoft" };

function safeNext(raw: string | null) {
  return raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : null;
}

/** Everything goes through /api/account/continue, which picks the right place to land. */
function continueUrl(next: string | null, isNew: boolean) {
  const q = new URLSearchParams();
  if (next) q.set("next", next);
  if (isNew) q.set("new", "1");
  return `/api/account/continue?${q}`;
}

const isFresh = (createdAt: string | Date | undefined) => !!createdAt && Date.now() - new Date(createdAt).getTime() < 60_000;

export function SignInForm({ providers, emailPassword, devMailHint }: { providers: Provider[]; emailPassword: boolean; devMailHint: boolean }) {
  const next = safeNext(useSearchParams().get("next"));
  const [view, setView] = useState<View>(emailPassword ? "password" : "code-email");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const go = (v: View) => {
    setError(null);
    setInfo(null);
    setView(v);
  };

  async function run(fn: () => Promise<{ error?: { message?: string } | null } | void>) {
    setError(null);
    setPending(true);
    try {
      const res = await fn();
      if (res && res.error) setError(res.error.message ?? "Something went wrong.");
    } finally {
      setPending(false);
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const field = (k: string) => String(f.get(k) ?? "");
    await run(async () => {
      switch (view) {
        case "password": {
          const r = await authClient.signIn.email({ email: field("email"), password: field("password") });
          if (!r.error) window.location.assign(continueUrl(next, false));
          return r;
        }
        case "sign-up": {
          const r = await authClient.signUp.email({ email: field("email"), password: field("password"), name: field("name") || field("email").split("@")[0] });
          if (!r.error) window.location.assign(continueUrl(next, true));
          return r;
        }
        case "code-email": {
          const r = await authClient.emailOtp.sendVerificationOtp({ email: field("email"), type: "sign-in" });
          if (!r.error) {
            setEmail(field("email"));
            go("code-verify");
            setInfo(`If ${field("email")} has an account, a 6-digit code is on its way.`);
          }
          return r;
        }
        case "code-verify": {
          const r = await authClient.signIn.emailOtp({ email, otp: field("otp") });
          if (!r.error) window.location.assign(continueUrl(next, isFresh(r.data?.user?.createdAt)));
          return r;
        }
        case "reset-email": {
          const r = await authClient.emailOtp.requestPasswordReset({ email: field("email") });
          if (!r.error) {
            setEmail(field("email"));
            go("reset-verify");
            setInfo(`If ${field("email")} has an account, a reset code is on its way.`);
          }
          return r;
        }
        case "reset-verify": {
          const password = field("password");
          const r = await authClient.emailOtp.resetPassword({ email, otp: field("otp"), password });
          if (r.error) return r;
          const s = await authClient.signIn.email({ email, password });
          if (!s.error) window.location.assign(continueUrl(next, false));
          return s;
        }
      }
    });
  }

  const codeInput = (
    <input
      name="otp"
      inputMode="numeric"
      autoComplete="one-time-code"
      pattern="[0-9]{6}"
      maxLength={6}
      placeholder="6-digit code"
      className="control text-center font-mono text-lg tracking-[0.5em]"
      required
      autoFocus
    />
  );
  const submitLabel: Record<View, string> = {
    password: "Sign in",
    "sign-up": "Create account",
    "code-email": "Email me a code",
    "code-verify": "Sign in",
    "reset-email": "Send reset code",
    "reset-verify": "Set new password",
  };
  const link = "font-medium text-ink underline underline-offset-2 hover:text-brand-700";

  return (
    <div className="space-y-6">
      {providers.length > 0 && (view === "password" || view === "sign-up" || view === "code-email") && (
        <>
          <div className="grid gap-2">
            {providers.map((p) => (
              <button
                key={p}
                type="button"
                className={buttonClass("secondary")}
                onClick={() => authClient.signIn.social({ provider: p, callbackURL: continueUrl(next, false), newUserCallbackURL: continueUrl(next, true) })}
              >
                Continue with {PROVIDER_LABELS[p]}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3 text-xs text-neutral-400">
            <div className="h-px flex-1 bg-line" /> or <div className="h-px flex-1 bg-line" />
          </div>
        </>
      )}

      <form onSubmit={onSubmit} className="space-y-3" key={view}>
        {view === "sign-up" && <input name="name" placeholder="Your name" autoComplete="name" className="control" required />}
        {(view === "password" || view === "sign-up" || view === "code-email" || view === "reset-email") && (
          <input name="email" type="email" placeholder="you@example.com" autoComplete="email" defaultValue={email} className="control" required />
        )}
        {(view === "password" || view === "sign-up") && (
          <input
            name="password"
            type="password"
            placeholder="Password (min. 10 characters)"
            autoComplete={view === "password" ? "current-password" : "new-password"}
            minLength={10}
            className="control"
            required
          />
        )}
        {(view === "code-verify" || view === "reset-verify") && codeInput}
        {view === "reset-verify" && (
          <input name="password" type="password" placeholder="New password (min. 10 characters)" autoComplete="new-password" minLength={10} className="control" required />
        )}
        {info && <p className="text-sm text-ink-soft">{info}</p>}
        {error && <p className="text-sm text-rose-700">{error}</p>}
        <button type="submit" disabled={pending} className={cx(buttonClass("primary"), "w-full")}>
          {pending ? "Please wait…" : submitLabel[view]}
        </button>
      </form>

      <div className="space-y-2 text-center text-sm text-ink-soft">
        {view === "password" && (
          <>
            <p><button type="button" className={link} onClick={() => go("code-email")}>Email me a sign-in code instead</button></p>
            <p><button type="button" className={link} onClick={() => go("reset-email")}>Forgot password?</button></p>
            <p>New to SpeakerDesk? <button type="button" className={link} onClick={() => go("sign-up")}>Create an account</button></p>
          </>
        )}
        {view === "sign-up" && <p>Already have an account? <button type="button" className={link} onClick={() => go("password")}>Sign in</button></p>}
        {view === "code-email" && (
          <>
            <p>
              No password needed. We&apos;ll email a code to your account address.
              {emailPassword && <> <button type="button" className={link} onClick={() => go("password")}>Use a password instead</button></>}
            </p>
            {emailPassword && <p>New to SpeakerDesk? <button type="button" className={link} onClick={() => go("sign-up")}>Create an account</button></p>}
          </>
        )}
        {(view === "code-verify" || view === "reset-verify") && (
          <p>
            Didn&apos;t get it? <button type="button" className={link} onClick={() => go(view === "code-verify" ? "code-email" : "reset-email")}>Send a new code</button>
          </p>
        )}
        {view === "reset-email" && <p><button type="button" className={link} onClick={() => go("password")}>Back to sign in</button></p>}
        {devMailHint && (view === "code-verify" || view === "reset-verify") && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">Development: no mail service is configured, so codes appear in the server log and in Admin → Email outbox.</p>
        )}
      </div>
    </div>
  );
}
