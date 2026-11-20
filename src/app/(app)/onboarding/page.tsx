import { Check, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { DetailsStep, VerifyStep } from "@/components/onboarding";
import { ActionButton } from "@/components/form-controls";
import { Badge, cx, Skeleton } from "@/components/ui";
import { finishOnboarding } from "@/lib/actions/onboarding";
import { requireUser } from "@/lib/dal";
import { mailConfigured } from "@/lib/mailer";
import { getOnboarding } from "@/lib/onboarding";

export const metadata: Metadata = { title: "Get set up" };

export default function OnboardingPage() {
  return (
    <Suspense fallback={<Skeleton rows={4} />}>
      <Onboarding />
    </Suspense>
  );
}

async function Onboarding() {
  const user = await requireUser();
  const o = await getOnboarding(user.id);
  const current = o.steps.find((s) => !s.done && s.required) ?? o.steps.find((s) => !s.done);
  const pct = Math.round((o.done / o.steps.length) * 100);
  const p = o.profile;

  return (
    <div className="mx-auto max-w-3xl">
      <p className="text-sm font-medium text-brand-600">Getting started</p>
      <h1 className="mt-1 text-4xl font-semibold tracking-tight">{o.requiredDone ? "You're all set" : `Welcome${p?.fullName ? `, ${p.fullName.split(" ")[0]}` : ""}. Let's get you set up.`}</h1>
      <p className="mt-2 text-ink-soft">
        {o.requiredDone ? "Everything essential is done. The optional steps make SpeakerDesk work even better." : `${o.requiredLeft} required step${o.requiredLeft === 1 ? "" : "s"} left. Takes about two minutes.`}
      </p>
      <div className="mt-5 h-2 overflow-hidden rounded-full bg-neutral-100"><div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} /></div>
      <p className="mt-1 text-xs text-ink-soft">{o.done} of {o.steps.length} done</p>

      <ol className="mt-8 space-y-3">
        {o.steps.map((s, i) => {
          const active = s.id === current?.id;
          return (
            <li key={s.id} className={cx("rounded-2xl border bg-surface", active ? "border-ink" : "border-line")}>
              <div className="flex items-start gap-4 p-5">
                <span className={cx("grid size-8 shrink-0 place-items-center rounded-full text-sm font-semibold", s.done ? "bg-emerald-500 text-paper" : active ? "bg-ink text-paper" : "bg-neutral-100 text-ink-soft")}>
                  {s.done ? <Check className="size-4" strokeWidth={3} /> : i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className={cx("font-semibold", s.done && "text-ink-soft")}>{s.title}</h2>
                    {!s.required && <Badge>Optional</Badge>}
                  </div>
                  <p className="text-sm text-ink-soft">{s.description}</p>
                </div>
                {s.href && !active && (
                  <Link href={s.href} className="inline-flex shrink-0 items-center gap-1 text-sm text-ink-soft hover:text-ink">{s.done ? "Review" : s.cta}<ChevronRight className="size-4" /></Link>
                )}
              </div>
              {active && (
                <div className="border-t border-line p-5">
                  {s.id === "details" && (
                    <DetailsStep
                      timezones={Intl.supportedValuesOf("timeZone")}
                      values={{
                        fullName: p?.fullName || user.name, pronouns: p?.pronouns ?? "", phone: p?.phone ?? "", country: p?.country ?? "", city: p?.city ?? "",
                        timezone: p?.timezone ?? "", company: p?.company ?? "", jobTitle: p?.jobTitle ?? "", primaryRole: o.role, termsAccepted: Boolean(o.termsAcceptedAt),
                      }}
                    />
                  )}
                  {s.id === "verify" && <VerifyStep email={user.email} devMailHint={!mailConfigured() && process.env.NODE_ENV !== "production"} />}
                  {s.href && <Link href={`${s.href}${s.href.includes("?") ? "&" : "?"}from=onboarding`} className="inline-flex items-center gap-1 rounded-lg bg-ink px-4 py-2 text-sm font-medium text-paper hover:bg-black">{s.cta}<ChevronRight className="size-4" /></Link>}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-neutral-100 px-5 py-4">
        <p className="text-sm text-ink-soft">{o.requiredDone ? "Ready when you are." : "Finish the required steps to complete setup — you can explore in the meantime."}</p>
        {o.requiredDone ? (
          <ActionButton action={finishOnboarding} variant="accent">{o.onboardedAt ? "Go to my home" : "Finish setup"}</ActionButton>
        ) : (
          <Link href={{ SPEAKER: "/dashboard", ORGANIZER: "/organize", SPONSOR: "/sponsor" }[o.role]} className="text-sm font-medium text-ink-soft hover:text-ink">Skip for now</Link>
        )}
      </div>
    </div>
  );
}
