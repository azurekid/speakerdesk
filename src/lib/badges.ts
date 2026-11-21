// Client-safe catalog of badge looks. Organizers pick an icon and a theme for their own badges,
// so every badge renders consistently (src/lib/badge-art.ts) and nobody needs to upload artwork.

export const BADGE_ICONS = ["award", "mic", "crown", "wrench", "sparkles", "users", "star", "megaphone", "heart", "ticket", "clipboard", "trophy", "rocket", "lightbulb", "medal", "flame"] as const;
export type BadgeIcon = (typeof BADGE_ICONS)[number];

export type BadgeTheme = {
  label: string;
  /** Outer band (dark) — also the icon outline. */
  band: string;
  /** Ring gradient, top-left to bottom-right. */
  ring: readonly string[];
  /** Night sky, top to horizon. */
  sky: readonly string[];
  /** Retro sun, top to bottom. */
  sun: readonly string[];
  floor: string;
  grid: string;
  /** Curved text colour. */
  text: string;
  icon: string;
};

/**
 * Themes, keyed by the colour names stored on badges (so existing badges keep working).
 * Inspired by Azure Heroes: synthwave neon, Azure blue, and a Credly-style sunset.
 */
export const BADGE_THEMES = {
  violet: { label: "Synthwave", band: "#140c33", ring: ["#22d3ee", "#a855f7", "#ec4899"], sky: ["#1e1b4b", "#581c87", "#9d174d"], sun: ["#fde047", "#fb923c", "#ec4899"], floor: "#1a0b3d", grid: "#e879f9", text: "#fde047", icon: "#ffffff" },
  sky: { label: "Azure", band: "#04162e", ring: ["#50e6ff", "#0078d4", "#0b3d91"], sky: ["#031a3a", "#0b3d91", "#1d6fd1"], sun: ["#e0f7ff", "#50e6ff", "#0078d4"], floor: "#052452", grid: "#50e6ff", text: "#50e6ff", icon: "#ffffff" },
  brand: { label: "Sunset", band: "#0e2236", ring: ["#fde047", "#f97316", "#dc2626"], sky: ["#0f2a44", "#1d4e6e", "#2b6d86"], sun: ["#fef08a", "#fbbf24", "#f97316"], floor: "#123247", grid: "#fbbf24", text: "#fbbf24", icon: "#ffffff" },
  amber: { label: "Gold", band: "#1f1606", ring: ["#fef9c3", "#eab308", "#a16207"], sky: ["#1c1917", "#422006", "#78350f"], sun: ["#fffbeb", "#fde047", "#f59e0b"], floor: "#271a05", grid: "#fbbf24", text: "#fde047", icon: "#ffffff" },
  emerald: { label: "Aurora", band: "#03231d", ring: ["#a7f3d0", "#10b981", "#0e7490"], sky: ["#022c22", "#065f46", "#0f766e"], sun: ["#ecfdf5", "#6ee7b7", "#14b8a6"], floor: "#02261f", grid: "#34d399", text: "#6ee7b7", icon: "#ffffff" },
  rose: { label: "Neon", band: "#2b0619", ring: ["#fbcfe8", "#ec4899", "#9d174d"], sky: ["#2b0619", "#831843", "#be185d"], sun: ["#fff1f2", "#f9a8d4", "#f43f5e"], floor: "#2e0820", grid: "#f472b6", text: "#f9a8d4", icon: "#ffffff" },
  slate: { label: "Steel", band: "#0b1220", ring: ["#f1f5f9", "#94a3b8", "#334155"], sky: ["#0f172a", "#1e293b", "#475569"], sun: ["#f8fafc", "#cbd5e1", "#64748b"], floor: "#0f172a", grid: "#94a3b8", text: "#e2e8f0", icon: "#ffffff" },
} as const satisfies Record<string, BadgeTheme>;

export type BadgeColor = keyof typeof BADGE_THEMES;
export const BADGE_COLORS: Record<BadgeColor, { label: string; ring: string }> = Object.fromEntries(
  Object.entries(BADGE_THEMES).map(([k, t]) => [k, { label: t.label, ring: t.ring[1] }]),
) as Record<BadgeColor, { label: string; ring: string }>;

export const isBadgeIcon = (v: string): v is BadgeIcon => (BADGE_ICONS as readonly string[]).includes(v);
export const isBadgeColor = (v: string): v is BadgeColor => v in BADGE_THEMES;

/** "CLOUD ONLINE 2027" → top-band text, adding the year when the name doesn't already have it. */
export function badgeTopText(eventName: string, date?: Date | null) {
  const year = date ? String(date.getUTCFullYear()) : "";
  return year && !eventName.includes(year) ? `${eventName} • ${year}` : eventName;
}
