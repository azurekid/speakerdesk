"use client";

import { useSyncExternalStore } from "react";
import { CharCount, CopyButton } from "@/components/form-controls";
import { cx } from "@/components/ui";
import { type CopyField, PLATFORM_PRESETS, takeawaysAsText } from "@/lib/platforms";

export type CopySource = {
  title: string;
  abstractShort: string;
  abstractLong: string;
  takeaways: string[];
  bioShort: string;
  bioMedium: string;
  bioLong: string;
  tagline: string;
  headshotSquareUrl: string;
};

const STORAGE_KEY = "speakerdesk:copy-preset";
const CHANGE_EVENT = "speakerdesk:copy-preset-change";
const DEFAULT_PRESET = PLATFORM_PRESETS[0].id;

// The last-used platform is remembered in localStorage (server render uses the default).
function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}
function readPreset() {
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved && PLATFORM_PRESETS.some((p) => p.id === saved) ? saved : DEFAULT_PRESET;
}
function savePreset(id: string) {
  localStorage.setItem(STORAGE_KEY, id);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

const LABELS: Record<CopyField, string> = {
  title: "Title",
  abstractShort: "Short pitch",
  abstractLong: "Master abstract",
  takeaways: "Key takeaways",
  bioShort: "Short bio",
  bioMedium: "Medium bio",
  bioLong: "Long bio",
  tagline: "Tagline",
};

export function CopyPanel({ source }: { source: CopySource }) {
  const presetId = useSyncExternalStore(subscribe, readPreset, () => DEFAULT_PRESET);
  const preset = PLATFORM_PRESETS.find((p) => p.id === presetId) ?? PLATFORM_PRESETS[0];

  const values: Record<CopyField, string> = {
    title: source.title,
    abstractShort: source.abstractShort,
    abstractLong: source.abstractLong,
    takeaways: takeawaysAsText(source.takeaways),
    bioShort: source.bioShort,
    bioMedium: source.bioMedium,
    bioLong: source.bioLong,
    tagline: source.tagline,
  };

  // The platform's main description box: prefer the preset's field, fall back to the other abstract if it fits better.
  const descLimit = preset.limits[preset.descriptionField];
  const fallback = preset.descriptionField === "abstractLong" ? "abstractShort" : "abstractLong";
  const descriptionField: CopyField =
    !values[preset.descriptionField] || (descLimit && values[preset.descriptionField].length > descLimit && values[fallback] && values[fallback].length <= descLimit)
      ? fallback
      : preset.descriptionField;

  const rows: { field: CopyField; role: string }[] = [
    { field: "title", role: "Title" },
    { field: descriptionField, role: "Description" },
    { field: descriptionField === "abstractLong" ? "abstractShort" : "abstractLong", role: "Alternate" },
    { field: "takeaways", role: "Takeaways" },
    { field: preset.bioField, role: "Bio" },
    { field: "tagline", role: "Tagline" },
  ];

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="preset" className="mb-1 block text-xs font-medium text-ink-soft">Paste into</label>
        <select
          id="preset"
          value={presetId}
          onChange={(e) => savePreset(e.target.value)}
          className="control"
        >
          {PLATFORM_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        {preset.notes && <p className="mt-1 text-xs text-ink-soft">{preset.notes}</p>}
        <p className="mt-1 text-[11px] text-neutral-400">Limits are typical defaults; each CfP can set its own.</p>
      </div>

      <ul className="divide-y divide-line">
        {rows.map(({ field, role }) => {
          const value = values[field];
          const limit = preset.limits[field];
          const over = limit !== undefined && value.length > limit;
          return (
            <li key={`${role}-${field}`} className="py-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">{role}</p>
                  {LABELS[field] !== role && <p className="truncate text-xs text-ink-soft">from {LABELS[field].toLowerCase()}</p>}
                </div>
                <CopyButton text={value} />
              </div>
              <div className="mt-1 min-w-0">
                <p className={cx("line-clamp-2 text-xs [overflow-wrap:anywhere]", value ? "text-ink-soft" : "italic text-neutral-400")}>{value || "Empty"}</p>
              </div>
              <div className="mt-1"><CharCount value={value} limit={limit} /></div>
              {over && <p className="mt-1 text-xs text-rose-700">Too long for {preset.name}&apos;s typical limit — trim it or use the other abstract.</p>}
            </li>
          );
        })}
        {source.headshotSquareUrl && (
          <li className="flex items-center justify-between gap-2 py-3">
            <div className="min-w-0">
              <p className="text-xs font-medium text-ink-soft">Headshot</p>
              <p className="truncate text-xs text-ink-soft">{source.headshotSquareUrl}</p>
            </div>
            <CopyButton text={source.headshotSquareUrl} label="Copy URL" />
          </li>
        )}
      </ul>
    </div>
  );
}
