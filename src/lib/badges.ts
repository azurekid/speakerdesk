// Client-safe catalog of badge looks. Organizers pick from these for their own badges, so every
// badge renders consistently and nobody needs to upload artwork.

export const BADGE_ICONS = ["award", "mic", "crown", "wrench", "sparkles", "users", "star", "megaphone", "heart", "ticket", "clipboard", "trophy", "rocket", "lightbulb", "medal", "flame"] as const;
export type BadgeIcon = (typeof BADGE_ICONS)[number];

export const BADGE_COLORS = {
  brand: { label: "Orange", ring: "#ea580c", fill: "#fff7ed", ink: "#9a3412" },
  amber: { label: "Gold", ring: "#d97706", fill: "#fffbeb", ink: "#92400e" },
  emerald: { label: "Green", ring: "#059669", fill: "#ecfdf5", ink: "#065f46" },
  sky: { label: "Blue", ring: "#0284c7", fill: "#f0f9ff", ink: "#075985" },
  violet: { label: "Purple", ring: "#7c3aed", fill: "#f5f3ff", ink: "#5b21b6" },
  rose: { label: "Pink", ring: "#e11d48", fill: "#fff1f2", ink: "#9f1239" },
  slate: { label: "Grey", ring: "#475569", fill: "#f8fafc", ink: "#1e293b" },
} as const;
export type BadgeColor = keyof typeof BADGE_COLORS;

export const isBadgeIcon = (v: string): v is BadgeIcon => (BADGE_ICONS as readonly string[]).includes(v);
export const isBadgeColor = (v: string): v is BadgeColor => v in BADGE_COLORS;
