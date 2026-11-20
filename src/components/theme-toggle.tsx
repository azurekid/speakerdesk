"use client";

import { Moon, Sun } from "lucide-react";

/**
 * Flips between light and dark and remembers the choice. Until someone clicks it, the theme
 * follows the operating system (see the inline script in app/layout.tsx).
 * Both icons are rendered and CSS picks one, so there is no hydration mismatch.
 */
export function ThemeToggle({ className = "" }: { className?: string }) {
  function toggle() {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("theme", next); } catch { /* private mode: the choice just won't persist */ }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle dark mode"
      title="Toggle dark mode"
      className={`inline-flex size-10 items-center md:size-8 justify-center rounded-lg text-ink-soft transition-colors hover:bg-neutral-100 hover:text-ink ${className}`}
    >
      <Moon className="size-4 dark:hidden" />
      <Sun className="hidden size-4 dark:block" />
    </button>
  );
}
