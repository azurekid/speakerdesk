"use client";

import { Building2, Megaphone, Mic } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormMessage, SubmitButton, useFormAction } from "@/components/form-controls";
import { buttonClass, cx, Field } from "@/components/ui";
import { saveOnboardingDetails } from "@/lib/actions/onboarding";
import { authClient } from "@/lib/auth-client";

type Details = {
  fullName: string; pronouns: string; phone: string; country: string; city: string; timezone: string; company: string; jobTitle: string;
  primaryRole: "SPEAKER" | "ORGANIZER" | "SPONSOR"; termsAccepted: boolean;
};

const ROLES = [
  { value: "SPEAKER", icon: Mic, title: "I give talks", body: "Profile, sessions, CfP submissions" },
  { value: "ORGANIZER", icon: Megaphone, title: "I run events", body: "CfPs, reviews, sponsors, runbook" },
  { value: "SPONSOR", icon: Building2, title: "I sponsor events", body: "Packages, requirements, deliverables" },
] as const;

export function DetailsStep({ values, timezones }: { values: Details; timezones: string[] }) {
  const router = useRouter();
  const [state, onSubmit, pending] = useFormAction(async (prev: Awaited<ReturnType<typeof saveOnboardingDetails>>, form: FormData) => {
    const r = await saveOnboardingDetails(prev, form);
    if (r?.ok) router.refresh();
    return r;
  }, undefined);
  // Clear a field's error as soon as it's edited, instead of waiting for the next submit.
  const [touched, setTouched] = useState<string[]>([]);
  const e = Object.fromEntries(Object.entries(state?.errors ?? {}).filter(([k]) => !touched.includes(k)));
  const guessTz = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "";
  const input = (name: keyof Details, label: string, opts: { placeholder?: string; type?: string; hint?: string; list?: string; autoComplete?: string; defaultValue?: string } = {}) => (
    <Field label={label} htmlFor={`ob-${name}`} error={e?.[name]} hint={opts.hint}>
      <input
        id={`ob-${name}`}
        name={name}
        type={opts.type ?? "text"}
        list={opts.list}
        autoComplete={opts.autoComplete}
        defaultValue={opts.defaultValue ?? String(values[name] ?? "")}
        placeholder={opts.placeholder}
        aria-invalid={e?.[name] ? true : undefined}
        className="control"
      />
    </Field>
  );

  return (
    <form
      onSubmit={(ev) => {
        setTouched([]);
        onSubmit(ev);
      }}
      onChange={(ev) => {
        const name = (ev.target as unknown as HTMLInputElement).name;
        if (name && !touched.includes(name)) setTouched((t) => [...t, name]);
      }}
      className="space-y-6"
    >
      <fieldset>
        <legend className="mb-2 text-sm font-medium">What brings you to SpeakerDesk?</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {ROLES.map(({ value, icon: Icon, title, body }) => (
            <label key={value} className="flex cursor-pointer gap-3 rounded-xl border border-line bg-surface p-3 transition has-checked:border-ink has-checked:ring-1 has-checked:ring-ink">
              <input type="radio" name="primaryRole" value={value} defaultChecked={values.primaryRole === value} className="sr-only" />
              <Icon className="mt-0.5 size-5 shrink-0 text-brand-600" />
              <span><span className="block text-sm font-medium">{title}</span><span className="text-xs text-ink-soft">{body}</span></span>
            </label>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-ink-soft">You can do all three with one account — this decides where we start.</p>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        {input("fullName", "Full name", { autoComplete: "name" })}
        {input("pronouns", "Pronouns (optional)", { placeholder: "e.g. she/her" })}
        {input("country", "Country", { autoComplete: "country-name", placeholder: "Netherlands" })}
        {input("city", "City", { autoComplete: "address-level2", placeholder: "Amsterdam" })}
        {input("timezone", "Timezone", { list: "ob-tz", defaultValue: values.timezone || guessTz, hint: "Used for deadlines and schedules." })}
        {input("phone", "Phone (optional)", { type: "tel", autoComplete: "tel", placeholder: "+31 6 1234 5678", hint: "Only shared with organizers of events you speak at." })}
        {input("company", "Company (optional)", { autoComplete: "organization" })}
        {input("jobTitle", "Job title (optional)", { autoComplete: "organization-title" })}
        <datalist id="ob-tz">{timezones.map((tz) => <option key={tz} value={tz} />)}</datalist>
      </div>

      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="terms" defaultChecked={values.termsAccepted} className="mt-0.5 accent-ink" />
        <span>I agree to the terms of use and the privacy policy.{e?.terms && <span className="block text-xs text-rose-700">{e.terms[0]}</span>}</span>
      </label>

      <div className="flex items-center gap-3">
        <SubmitButton pending={pending}>Save and continue</SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

export function VerifyStep({ email, devMailHint }: { email: string; devMailHint: boolean }) {
  const router = useRouter();
  const [sent, setSent] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, setPending] = useState(false);

  async function send() {
    setPending(true);
    const r = await authClient.emailOtp.sendVerificationOtp({ email, type: "email-verification" });
    setPending(false);
    if (r.error) return setMsg({ ok: false, text: r.error.message ?? "Couldn't send the code." });
    setSent(true);
    setMsg({ ok: true, text: `We sent a 6-digit code to ${email}.` });
  }

  return (
    <div className="space-y-3">
      {!sent ? (
        <button type="button" onClick={send} disabled={pending} className={buttonClass("primary")}>{pending ? "Sending…" : `Send a code to ${email}`}</button>
      ) : (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            setPending(true);
            const otp = String(new FormData(e.currentTarget).get("otp"));
            const r = await authClient.emailOtp.verifyEmail({ email, otp });
            setPending(false);
            if (r.error) return setMsg({ ok: false, text: r.error.message ?? "That code didn't work." });
            router.refresh();
          }}
        >
          <input name="otp" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} placeholder="6-digit code" className="control w-40 text-center font-mono tracking-[0.4em]" required autoFocus />
          <button type="submit" disabled={pending} className={buttonClass("primary")}>Verify</button>
          <button type="button" onClick={send} className={buttonClass("ghost")}>Resend</button>
        </form>
      )}
      {msg && <p className={cx("text-sm", msg.ok ? "text-ink-soft" : "text-rose-700")}>{msg.text}</p>}
      {devMailHint && sent && <p className="text-xs text-amber-800">Development: the code is in the server log and Admin → Email outbox.</p>}
    </div>
  );
}
