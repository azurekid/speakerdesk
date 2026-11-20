// Character-limit presets for the copy panel.
//
// CfP organizers configure their own limits per event, so these are *typical
// defaults* to warn against, not hard rules. Tune them here as you learn more.

export type CopyField =
  | "title"
  | "abstractShort"
  | "abstractLong"
  | "takeaways"
  | "bioShort"
  | "bioMedium"
  | "bioLong"
  | "tagline";

export type PlatformPreset = {
  id: string;
  name: string;
  /** Which of our fields maps to the platform's main description box. */
  descriptionField: "abstractShort" | "abstractLong";
  /** Which bio the platform usually asks for. */
  bioField: "bioShort" | "bioMedium" | "bioLong";
  limits: Partial<Record<CopyField, number>>;
  notes?: string;
};

export const PLATFORM_PRESETS: PlatformPreset[] = [
  {
    id: "sessionize",
    name: "Sessionize",
    descriptionField: "abstractLong",
    bioField: "bioMedium",
    limits: { title: 100, abstractLong: 1000, abstractShort: 500, bioMedium: 1000, tagline: 100 },
    notes: "Lightning-talk CfPs often cap the description at ~500 characters.",
  },
  {
    id: "run-events",
    name: "run.events",
    descriptionField: "abstractLong",
    bioField: "bioMedium",
    limits: { title: 120, abstractLong: 2000, abstractShort: 500, takeaways: 1000, bioMedium: 1000 },
    notes: "Paste key takeaways into the learning objectives box.",
  },
  {
    id: "pretalx",
    name: "Pretalx",
    descriptionField: "abstractLong",
    bioField: "bioLong",
    limits: { title: 200, abstractShort: 1000, abstractLong: 3000 },
    notes: "Pretalx has separate Abstract (short) and Description (long) fields.",
  },
  {
    id: "papercall",
    name: "PaperCall",
    descriptionField: "abstractShort",
    bioField: "bioMedium",
    limits: { title: 150, abstractShort: 600, abstractLong: 3000 },
    notes: "PaperCall's Abstract is public; Details/Notes are for reviewers.",
  },
  {
    id: "none",
    name: "No limits",
    descriptionField: "abstractLong",
    bioField: "bioLong",
    limits: {},
  },
];

export function takeawaysAsText(takeaways: string[]): string {
  return takeaways.filter(Boolean).map((t) => `- ${t}`).join("\n");
}
