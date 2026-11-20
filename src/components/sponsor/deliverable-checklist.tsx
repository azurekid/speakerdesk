"use client";

import { useOptimistic, useTransition } from "react";
import { cx } from "@/components/ui";
import { toggleDeliverable } from "@/lib/actions/sponsorship";

export function DeliverableChecklist({ sponsorshipId, items, completed }: { sponsorshipId: string; items: string[]; completed: string[] }) {
  const [, startTransition] = useTransition();
  const [done, setDone] = useOptimistic(completed, (state, change: { item: string; on: boolean }) =>
    change.on ? [...state, change.item] : state.filter((x) => x !== change.item),
  );
  return (
    <ul className="space-y-1.5">
      {items.map((item) => {
        const on = done.includes(item);
        return (
          <li key={item}>
            <label className="flex cursor-pointer items-center gap-2.5 text-sm">
              <input
                type="checkbox"
                checked={on}
                onChange={(e) => {
                  const next = e.target.checked;
                  startTransition(async () => {
                    setDone({ item, on: next });
                    await toggleDeliverable(sponsorshipId, item, next);
                  });
                }}
                className="size-4 accent-emerald-600"
              />
              <span className={cx(on && "text-ink-soft line-through")}>{item}</span>
            </label>
          </li>
        );
      })}
    </ul>
  );
}
