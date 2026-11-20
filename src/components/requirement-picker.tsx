"use client";

import { Check } from "lucide-react";
import type { RequirementGroup } from "@/lib/requirements";

/** Grouped checkbox chips; submits one `name` entry per selected requirement id. */
export function RequirementPicker({ name, groups, defaultValue = [] }: { name: string; groups: RequirementGroup[]; defaultValue?: string[] }) {
  return (
    <div className="space-y-5">
      {groups.map((g) => (
        <fieldset key={g.group}>
          <legend className="mb-2 text-xs font-medium text-ink-soft">{g.group}</legend>
          <div className="flex flex-wrap gap-2">
            {g.items.map((item) => (
              <label key={item.id} className="group cursor-pointer">
                <input type="checkbox" name={name} value={item.id} defaultChecked={defaultValue.includes(item.id)} className="peer sr-only" />
                <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-sm text-ink-soft transition peer-checked:border-ink peer-checked:bg-ink peer-checked:text-paper peer-focus-visible:ring-2 peer-focus-visible:ring-brand-500 hover:border-neutral-400">
                  <Check className="hidden size-3.5 group-has-checked:block" strokeWidth={3} />
                  {item.label}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  );
}
