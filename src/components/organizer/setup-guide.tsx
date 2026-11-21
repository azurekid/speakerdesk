import { ArrowRight, Check } from "lucide-react";
import Link from "next/link";
import { ActionButton } from "@/components/form-controls";
import { ShowTipsAgain } from "@/components/organizer/page-tip";
import { ButtonLink, cx } from "@/components/ui";
import { setGuideHidden } from "@/lib/actions/events";
import type { getSetupGuide } from "@/lib/setup-guide";

type Guide = Awaited<ReturnType<typeof getSetupGuide>>;

/**
 * Step-by-step setup for a new event, on its overview. The current step is open with what it's
 * for and how to do it; the rest are a checklist. Steps tick themselves off from real data.
 */
export function SetupGuide({ eventId, guide }: { eventId: string; guide: Guide }) {
  const { steps, current, essentialsDone, essentialsTotal } = guide;
  const allEssentials = essentialsDone === essentialsTotal;
  const pct = Math.round((essentialsDone / essentialsTotal) * 100);

  return (
    <section aria-labelledby="setup-guide" className="rounded-2xl border border-line bg-surface">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
        <div className="min-w-0">
          <h2 id="setup-guide" className="font-display text-xl font-semibold tracking-tight">
            {allEssentials ? "Your event is set up" : "Set up your event, step by step"}
          </h2>
          <p className="mt-0.5 text-sm text-ink-soft">
            {essentialsDone} of {essentialsTotal} essential steps done. Steps tick themselves off as you go.
          </p>
          <div className="mt-3 h-1.5 w-full max-w-sm overflow-hidden rounded-full bg-neutral-100" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Setup progress">
            <div className="h-full rounded-full bg-brand-600" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <ActionButton action={setGuideHidden.bind(null, eventId, true)} variant="ghost">Hide guide</ActionButton>
      </header>

      <div className="grid gap-0 lg:grid-cols-[1fr_1.1fr]">
        <ol className="divide-y divide-line border-line lg:border-r">
          {steps.map((step, i) => {
            const isCurrent = current?.id === step.id;
            return (
              <li key={step.id}>
                <Link href={step.href} className={cx("flex items-center gap-3 px-5 py-2.5 text-sm hover:bg-neutral-50", isCurrent && "bg-neutral-50")} aria-current={isCurrent ? "step" : undefined}>
                  <span
                    className={cx(
                      "grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold tabular-nums",
                      step.done ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200" : isCurrent ? "bg-ink text-paper" : "border border-line text-ink-soft",
                    )}
                  >
                    {step.done ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
                  </span>
                  <span className={cx("min-w-0 flex-1", step.done ? "text-ink-soft line-through decoration-line" : isCurrent ? "font-medium text-ink" : "text-ink")}>{step.title}</span>
                  {step.optional && !step.done && <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] text-ink-soft">Optional</span>}
                </Link>
              </li>
            );
          })}
        </ol>

        <div className="px-5 py-5">
          {current ? (
            <>
              <p className="text-xs font-medium uppercase tracking-wide text-brand-700">{current.optional ? "Optional next step" : `Step ${steps.indexOf(current) + 1} of ${steps.length}`}</p>
              <h3 className="mt-1 font-display text-2xl font-semibold tracking-tight">{current.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{current.why}</p>
              <ul className="mt-4 space-y-2 text-sm">
                {current.how.map((h) => (
                  <li key={h} className="flex gap-3"><span className="mt-2 h-px w-3 shrink-0 bg-brand-500" />{h}</li>
                ))}
              </ul>
              <ButtonLink href={current.href} variant="accent" className="mt-5">
                {current.cta} <ArrowRight className="size-4" />
              </ButtonLink>
            </>
          ) : (
            <>
              <h3 className="font-display text-2xl font-semibold tracking-tight">Everything&apos;s in place</h3>
              <p className="mt-2 text-sm text-ink-soft">Your CfP, decisions, schedule and extras are done. Enjoy the event, and you can hide this guide now.</p>
            </>
          )}
          <p className="mt-6 border-t border-line pt-4 text-xs text-ink-soft">
            Each tab also has a short tip at the top. Dismissed them? <ShowTipsAgain className="underline hover:text-ink" />
          </p>
        </div>
      </div>
    </section>
  );
}

/** Shown in place of the guide after someone hid it. */
export function ShowGuideLink({ eventId }: { eventId: string }) {
  return (
    <div className="flex justify-end">
      <ActionButton action={setGuideHidden.bind(null, eventId, false)} variant="ghost">Show setup guide</ActionButton>
    </div>
  );
}
