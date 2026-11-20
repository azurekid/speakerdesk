"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { FormMessage, SubmitButton, useFormAction } from "@/components/form-controls";
import { TabBar } from "@/components/organizer/controls";
import { buttonClass, Card, Field } from "@/components/ui";
import { adminBan, adminChangeEmail, adminDeleteUser, adminLogImpersonation, adminSendResetCode, adminSetPassword } from "@/lib/actions/admin";
import { authClient } from "@/lib/auth-client";
import type { ActionState } from "@/lib/validation";

export function AdminTabs() {
  const pathname = usePathname();
  const tabs = [
    { href: "/admin", label: "Overview", exact: true },
    { href: "/admin/users", label: "Users" },
    { href: "/admin/events", label: "Events" },
    { href: "/admin/outbox", label: "Email outbox" },
    { href: "/admin/audit", label: "Audit log" },
  ];
  return <TabBar tabs={tabs} isActive={(t) => (t.exact ? pathname === t.href : pathname.startsWith(t.href))} />;
}

/** Generates a strong temporary password the admin can share with the user. */
function tempPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(14));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

export function SetPasswordForm({ userId }: { userId: string }) {
  const [state, onSubmit, pending] = useFormAction(adminSetPassword.bind(null, userId), undefined);
  const [value, setValue] = useState("");
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <input name="password" value={value} onChange={(e) => setValue(e.target.value)} minLength={10} required placeholder="New password (min. 10)" className="control max-w-xs font-mono" />
        <button type="button" onClick={() => setValue(tempPassword())} className={buttonClass("secondary")}>Generate</button>
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="revoke" defaultChecked className="accent-ink" /> Sign the user out everywhere</label>
      <div className="flex items-center gap-3">
        <SubmitButton pending={pending} variant="secondary">Set password</SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

export function SendResetCodeButton({ userId }: { userId: string }) {
  const [state, setState] = useState<ActionState>(undefined);
  const [pending, setPending] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        disabled={pending}
        className={buttonClass("secondary")}
        onClick={async () => {
          setPending(true);
          setState(await adminSendResetCode(userId));
          setPending(false);
        }}
      >
        {pending ? "Sending…" : "Email a password reset code"}
      </button>
      <FormMessage state={state} />
    </div>
  );
}

export function ChangeEmailForm({ userId, email }: { userId: string; email: string }) {
  const [state, onSubmit, pending] = useFormAction(adminChangeEmail.bind(null, userId), undefined);
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <input name="email" type="email" defaultValue={email} required className="control max-w-sm" />
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="verified" className="accent-ink" /> Mark the new address as verified</label>
      <div className="flex items-center gap-3">
        <SubmitButton pending={pending} variant="secondary">Change email</SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

export function BanForm({ userId }: { userId: string }) {
  const [state, onSubmit, pending] = useFormAction(adminBan.bind(null, userId), undefined);
  return (
    <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-[1fr_140px_auto] sm:items-end">
      <Field label="Reason" htmlFor="ban-reason">
        <input id="ban-reason" name="reason" placeholder="Spam submissions" className="control" />
      </Field>
      <Field label="Days (empty = permanent)" htmlFor="ban-days">
        <input id="ban-days" name="days" type="number" min={1} className="control" />
      </Field>
      <SubmitButton pending={pending} variant="danger">Ban user</SubmitButton>
      <div className="sm:col-span-3"><FormMessage state={state} /></div>
    </form>
  );
}

export function ImpersonateButton({ userId, name }: { userId: string; name: string }) {
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      <button
        type="button"
        className={buttonClass("secondary")}
        onClick={async () => {
          if (!window.confirm(`Sign in as ${name} for support? This is recorded in the audit log.`)) return;
          await adminLogImpersonation(userId);
          const r = await authClient.admin.impersonateUser({ userId });
          if (r.error) return setError(r.error.message ?? "Couldn't start support session.");
          // Full reload: the session just changed, so all server components must re-render.
          // eslint-disable-next-line @next/next/no-location-assign-relative-destination
          window.location.assign("/api/account/continue");
        }}
      >
        View as {name.split(" ")[0]}
      </button>
      {error && <p className="text-sm text-rose-700">{error}</p>}
    </div>
  );
}

export function DeleteUserForm({ userId, email }: { userId: string; email: string }) {
  const [state, onSubmit, pending] = useFormAction(adminDeleteUser.bind(null, userId), undefined);
  return (
    <Card title="Delete account" description="Removes the user, their profile, sessions, talks and proposals. Can't be undone.">
      <form onSubmit={onSubmit} className="space-y-3">
        <Field label={`Type ${email} to confirm`} htmlFor="del-confirm">
          <input id="del-confirm" name="confirm" autoComplete="off" className="control max-w-sm" />
        </Field>
        <div className="flex items-center gap-3">
          <SubmitButton pending={pending} variant="danger">Delete account</SubmitButton>
          <FormMessage state={state} />
        </div>
      </form>
    </Card>
  );
}
