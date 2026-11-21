"use client";

import { Check } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui";
import { SETUP_STEPS, type SetupStepId, settingsPath } from "@/lib/event-setup";

/** The setup steps as a numbered list: where you are, and which steps are already done. */
export function SetupSteps({ eventId, done, owner }: { eventId: string; done: Partial<Record<SetupStepId, boolean>>; owner: boolean }) {
  const pathname = usePathname();
  const current = [...SETUP_STEPS].reverse().find((s) => pathname === settingsPath(eventId, s.id))?.id;
  return (
    <nav aria-label="Event setup" className="lg:sticky lg:top-6">
      <ol className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:gap-0 lg:overflow-visible lg:pb-0">
        {SETUP_STEPS.map((step, i) => {
          const active = step.id === current;
          return (
            <li key={step.id} className="shrink-0">
              <Link
                href={settingsPath(eventId, step.id)}
                aria-current={active ? "step" : undefined}
                className={cx("flex items-start gap-3 rounded-lg px-3 py-2.5 text-sm", active ? "bg-surface ring-1 ring-line" : "hover:bg-neutral-50")}
              >
                <span
                  className={cx(
                    "mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold",
                    done[step.id] ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200" : active ? "bg-ink text-paper" : "border border-line text-ink-soft",
                  )}
                >
                  {done[step.id] ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
                </span>
                <span className="min-w-0">
                  <span className={cx("block whitespace-nowrap lg:whitespace-normal", active ? "font-medium text-ink" : "text-ink")}>{step.label}</span>
                  <span className="hidden text-xs text-ink-soft lg:block">{step.hint}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
      {owner && (
        <Link href={`/organize/${eventId}/settings/delete`} className="mt-4 hidden px-3 text-xs text-ink-soft underline hover:text-rose-700 lg:block">
          Delete event
        </Link>
      )}
    </nav>
  );
}
