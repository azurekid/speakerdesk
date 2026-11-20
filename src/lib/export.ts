import { FORMAT_LABELS, LEVEL_LABELS, type TalkFormat, type TalkLevel } from "@/lib/domain";

type TalkLike = {
  title: string;
  subtitle: string;
  abstractShort: string;
  abstractLong: string;
  outline: string;
  takeaways: string[];
  format: TalkFormat;
  durationMinutes: number;
  level: TalkLevel;
  primaryTrack: string;
  tags: string[];
  slidesUrl: string;
  videoUrl: string;
};

type ProfileLike = {
  fullName: string;
  tagline: string;
  bioMedium: string;
  bioLong: string;
  headshotSquareUrl: string;
  websiteUrl: string;
  linkedinUrl: string;
  githubUrl: string;
  xUrl: string;
  blueskyUrl: string;
  mastodonUrl: string;
};

export function talkToMarkdown(t: TalkLike, level = 1): string {
  const h = "#".repeat(level);
  const lines = [`${h} ${t.title}`];
  if (t.subtitle) lines.push(`_${t.subtitle}_`);
  lines.push(
    "",
    `**Format:** ${FORMAT_LABELS[t.format]} · **Duration:** ${t.durationMinutes} min · **Level:** ${LEVEL_LABELS[t.level]}` +
      (t.primaryTrack ? ` · **Track:** ${t.primaryTrack}` : ""),
  );
  if (t.tags.length) lines.push(`**Tags:** ${t.tags.join(", ")}`);
  if (t.abstractShort) lines.push("", `${h}# Pitch`, "", t.abstractShort);
  if (t.abstractLong) lines.push("", `${h}# Abstract`, "", t.abstractLong);
  if (t.takeaways.length) lines.push("", `${h}# Key takeaways`, "", ...t.takeaways.map((x) => `- ${x}`));
  if (t.outline) lines.push("", `${h}# Outline`, "", t.outline);
  const links = [t.slidesUrl && `[Slides](${t.slidesUrl})`, t.videoUrl && `[Recording](${t.videoUrl})`].filter(Boolean);
  if (links.length) lines.push("", links.join(" · "));
  return lines.join("\n") + "\n";
}

export function speakerKitMarkdown(p: ProfileLike | null, talks: TalkLike[]): string {
  const out: string[] = [];
  if (p) {
    out.push(`# ${p.fullName || "Speaker"}`);
    if (p.tagline) out.push(`_${p.tagline}_`);
    if (p.headshotSquareUrl) out.push("", `![Headshot](${p.headshotSquareUrl})`);
    const bio = p.bioLong || p.bioMedium;
    if (bio) out.push("", "## Bio", "", bio);
    const links = (
      [
        ["Website", p.websiteUrl],
        ["LinkedIn", p.linkedinUrl],
        ["GitHub", p.githubUrl],
        ["X", p.xUrl],
        ["Bluesky", p.blueskyUrl],
        ["Mastodon", p.mastodonUrl],
      ] as const
    ).filter(([, u]) => u);
    if (links.length) out.push("", "## Links", "", ...links.map(([n, u]) => `- [${n}](${u})`));
    out.push("", "## Sessions", "");
  }
  for (const t of talks) out.push(talkToMarkdown(t, p ? 3 : 2));
  return out.join("\n");
}

const CSV_COLUMNS = [
  "title", "subtitle", "abstractShort", "abstractLong", "outline", "takeaways",
  "format", "durationMinutes", "level", "primaryTrack", "tags", "language", "slidesUrl", "videoUrl",
] as const;

function csvCell(v: string | number): string {
  let s = String(v);
  // Neutralize spreadsheet formula injection.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function talksToCsv(talks: (TalkLike & { language: string })[]): string {
  const rows = talks.map((t) =>
    CSV_COLUMNS.map((c) => (c === "takeaways" ? csvCell(t.takeaways.join("\n")) : c === "tags" ? csvCell(t.tags.join(", ")) : csvCell(t[c]))).join(","),
  );
  return [CSV_COLUMNS.join(","), ...rows].join("\r\n") + "\r\n";
}
