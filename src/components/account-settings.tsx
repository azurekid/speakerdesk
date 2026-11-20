"use client";

import { CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormMessage, SubmitButton, useFormAction } from "@/components/form-controls";
import { Badge, buttonClass, Card, cx, Field } from "@/components/ui";
import { setAccountPassword } from "@/lib/actions/account";
import { authClient } from "@/lib/auth-client";

type Msg = { ok: boolean; message: string } | null;

function Notice({ msg }: { msg: Msg }) {
  if (!msg) return null;
  return <p role="status" className={cx("rounded-lg px-3 py-2 text-sm", msg.ok ? "bg-emerald-50 text-emerald-900" : "bg-rose-50 text-rose-800")}>{msg.message}</p>;
}

const codeInput = (name = "otp") => (
  <input name={name} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} placeholder="6-digit code" className="control w-40 text-center font-mono tracking-[0.4em]" required />
);

/** Verify the current address, or move the account to a new one — both by 6-digit code. */
export function EmailSettings({ email, verified, devMailHint }: { email: string; verified: boolean; devMailHint: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState<"idle" | "verify-code" | "change-code">("idle");
  const [newEmail, setNewEmail] = useState("");
  const [msg, setMsg] = useState<Msg>(null);
  const [pending, setPending] = useState(false);

  async function act(fn: () => Promise<{ error?: { message?: string } | null }>, ok: string, then?: () => void) {
    setPending(true);
    setMsg(null);
    const r = await fn();
    setPending(false);
    if (r.error) return setMsg({ ok: false, message: r.error.message ?? "Something went wrong." });
    setMsg({ ok: true, message: ok });
    then?.();
  }

  return (
    <Card title="Email address" description="Used to sign in and for notifications.">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-medium">{email}</span>
          {verified ? (
            <Badge className="bg-emerald-50 text-emerald-800 ring-emerald-200"><CheckCircle2 className="size-3" />Verified</Badge>
          ) : (
            <>
              <Badge className="bg-amber-50 text-amber-800 ring-amber-200">Not verified</Badge>
              {step !== "verify-code" && (
                <button
                  type="button"
                  disabled={pending}
                  className={buttonClass("secondary", "sm")}
                  onClick={() => act(() => authClient.emailOtp.sendVerificationOtp({ email, type: "email-verification" }), `We sent a code to ${email}.`, () => setStep("verify-code"))}
                >
                  Verify now
                </button>
              )}
            </>
          )}
        </div>

        {step === "verify-code" && (
          <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const otp = String(new FormData(e.currentTarget).get("otp"));
              act(() => authClient.emailOtp.verifyEmail({ email, otp }), "Email verified.", () => {
                setStep("idle");
                router.refresh();
              });
            }}
          >
            {codeInput()}
            <button type="submit" disabled={pending} className={buttonClass("primary")}>Verify</button>
          </form>
        )}

        <div className="border-t border-line pt-5">
          <p className="mb-2 text-sm font-medium">Change email address</p>
          {step === "change-code" ? (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                const otp = String(new FormData(e.currentTarget).get("otp"));
                act(() => authClient.emailOtp.changeEmail({ newEmail, otp }), `Your email is now ${newEmail}.`, () => {
                  setStep("idle");
                  router.refresh();
                });
              }}
            >
              <p className="text-sm text-ink-soft">Enter the code we sent to <span className="font-medium text-ink">{newEmail}</span>.</p>
              <div className="flex flex-wrap items-center gap-2">
                {codeInput()}
                <button type="submit" disabled={pending} className={buttonClass("primary")}>Confirm new email</button>
                <button type="button" onClick={() => setStep("idle")} className={buttonClass("ghost")}>Cancel</button>
              </div>
            </form>
          ) : (
            <form
              className="flex flex-wrap gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const value = String(new FormData(e.currentTarget).get("newEmail")).trim().toLowerCase();
                if (value === email.toLowerCase()) return setMsg({ ok: false, message: "That's already your email." });
                setNewEmail(value);
                act(() => authClient.emailOtp.requestEmailChange({ newEmail: value }), `We sent a code to ${value}.`, () => setStep("change-code"));
              }}
            >
              <input name="newEmail" type="email" required placeholder="new@example.com" className="control max-w-sm" />
              <button type="submit" disabled={pending} className={buttonClass("secondary")}>Send code to new address</button>
            </form>
          )}
        </div>
        <Notice msg={msg} />
        {devMailHint && step !== "idle" && <p className="text-xs text-amber-800">Development: codes appear in the server log and in Admin → Email outbox.</p>}
      </div>
    </Card>
  );
}

export function PasswordSettings({ hasPassword }: { hasPassword: boolean }) {
  const [msg, setMsg] = useState<Msg>(null);
  const [pending, setPending] = useState(false);
  const [setState, onSet, setting] = useFormAction(setAccountPassword, undefined);

  if (!hasPassword) {
    return (
      <Card title="Password" description="You sign in with a code or a social account. Add a password if you'd like another way in.">
        <form onSubmit={onSet} className="grid max-w-md gap-3">
          <Field label="New password" htmlFor="pw-new" error={setState?.errors?.password}>
            <input id="pw-new" name="password" type="password" minLength={10} autoComplete="new-password" className="control" required />
          </Field>
          <Field label="Repeat password" htmlFor="pw-confirm" error={setState?.errors?.confirm}>
            <input id="pw-confirm" name="confirm" type="password" minLength={10} autoComplete="new-password" className="control" required />
          </Field>
          <div className="flex items-center gap-3">
            <SubmitButton pending={setting}>Set password</SubmitButton>
            <FormMessage state={setState} />
          </div>
        </form>
      </Card>
    );
  }

  return (
    <Card title="Password">
      <form
        className="grid max-w-md gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          const formEl = e.currentTarget;
          const f = new FormData(formEl);
          const next = String(f.get("newPassword"));
          if (next !== String(f.get("confirm"))) return setMsg({ ok: false, message: "The new passwords don't match." });
          setPending(true);
          setMsg(null);
          const r = await authClient.changePassword({ currentPassword: String(f.get("currentPassword")), newPassword: next, revokeOtherSessions: f.get("revoke") === "on" });
          setPending(false);
          if (r.error) return setMsg({ ok: false, message: r.error.message ?? "Couldn't change the password." });
          formEl.reset();
          setMsg({ ok: true, message: "Password changed." });
        }}
      >
        <Field label="Current password" htmlFor="pw-current">
          <input id="pw-current" name="currentPassword" type="password" autoComplete="current-password" className="control" required />
        </Field>
        <Field label="New password" htmlFor="pw-next" hint="At least 10 characters.">
          <input id="pw-next" name="newPassword" type="password" minLength={10} autoComplete="new-password" className="control" required />
        </Field>
        <Field label="Repeat new password" htmlFor="pw-repeat">
          <input id="pw-repeat" name="confirm" type="password" minLength={10} autoComplete="new-password" className="control" required />
        </Field>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="revoke" defaultChecked className="accent-ink" /> Sign out my other devices</label>
        <div className="flex items-center gap-3">
          <button type="submit" disabled={pending} className={buttonClass("primary")}>{pending ? "Saving…" : "Change password"}</button>
        </div>
        <Notice msg={msg} />
      </form>
    </Card>
  );
}

export function SignOutOthers() {
  const router = useRouter();
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={buttonClass("secondary", "sm")}
      onClick={async () => {
        await authClient.revokeOtherSessions();
        setDone(true);
        router.refresh();
      }}
    >
      {done ? "Signed out ✓" : "Sign out other devices"}
    </button>
  );
}
