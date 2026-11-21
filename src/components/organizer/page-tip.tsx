"use client";

import { Lightbulb, X } from "lucide-react";
import { useSyncExternalStore } from "react";

// Short "how this page works" notes on the event workspace tabs. Dismissed tips are remembered
// in this browser; the setup guide can bring them all back.

const PREFIX = "sd-tip:";
const CHANGED = "sd-tips-changed";

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGED, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGED, onChange);
  };
}

const isDismissed = (id: string) => {
  try {
    return localStorage.getItem(PREFIX + id) === "1";
  } catch {
    return false;
  }
};

export function PageTip({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  // Hidden on the server and in the first client render, so hydration always matches.
  const dismissed = useSyncExternalStore(subscribe, () => isDismissed(id), () => true);
  if (dismissed) return null;
  const dismiss = () => {
    try {
      localStorage.setItem(PREFIX + id, "1");
    } catch {
      /* private mode: the tip just comes back next time */
    }
    window.dispatchEvent(new Event(CHANGED));
  };
  return (
    <aside className="mb-6 flex gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
      <Lightbulb className="mt-0.5 size-4 shrink-0 text-sky-800" />
      <div className="min-w-0 flex-1">
        <p className="font-medium">{title}</p>
        <div className="mt-1 space-y-1 text-sky-800 [&_ul]:list-disc [&_ul]:space-y-0.5 [&_ul]:pl-4">{children}</div>
      </div>
      <button type="button" onClick={dismiss} className="-m-1 grid size-9 shrink-0 place-items-center rounded-md text-sky-800 hover:bg-sky-200/50" aria-label="Hide this tip">
        <X className="size-4" />
      </button>
    </aside>
  );
}

/** Brings back every dismissed page tip. */
export function ShowTipsAgain({ className }: { className?: string }) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        try {
          for (const key of Object.keys(localStorage)) if (key.startsWith(PREFIX)) localStorage.removeItem(key);
        } catch {
          /* nothing stored */
        }
        window.dispatchEvent(new Event(CHANGED));
      }}
    >
      Show page tips again
    </button>
  );
}
