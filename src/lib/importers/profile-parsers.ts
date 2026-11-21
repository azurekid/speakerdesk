// Parsers for public speaker profile pages. Pure functions (no I/O) so they can be tested
// against saved pages. The pages are server-rendered HTML; we read them by their stable CSS
// class names. If a site changes its markup, these return fewer fields rather than throwing.

import type { ImportedProfile, ImportedTalk } from "./types";

export type ProfileSource = "sessionize" | "runevents";
export type ParsedProfile = { source: ProfileSource; profile: ImportedProfile; talks: ImportedTalk[]; topics: string[] };

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", ndash: "–", mdash: "—", hellip: "…" };

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

/** HTML fragment → plain text with paragraph breaks kept. */
export function htmlToText(html: string): string {
  const text = html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n\n")
    .replace(/<[^>]+>/g, "");
  return decodeEntities(text)
    .split("\n")
    .map((l) => l.replace(/[ \t ]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const first = (html: string, re: RegExp) => {
  const m = re.exec(html);
  return m ? htmlToText(m[1]) : "";
};

/** "Amersfoort, The Netherlands" → city + country. */
function splitLocation(loc: string): { city?: string; country?: string } {
  const parts = loc.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) return { city: parts.slice(0, -1).join(", "), country: parts.at(-1) };
  return parts.length ? { country: parts[0] } : {};
}

/** Sorts profile links into SpeakerDesk's fields by host. */
function assignLink(profile: ImportedProfile, href: string, label = "") {
  let host = "";
  try {
    const u = new URL(href);
    if (u.protocol !== "https:" && u.protocol !== "http:") return;
    host = u.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return;
  }
  const url = href.replace(/^http:\/\//i, "https://");
  const l = label.toLowerCase();
  if (host.endsWith("linkedin.com")) profile.linkedinUrl ||= url;
  else if (host === "twitter.com" || host === "x.com") profile.xUrl ||= url;
  else if (host === "github.com") profile.githubUrl ||= url;
  else if (host === "bsky.app" || l.includes("bluesky")) profile.blueskyUrl ||= url;
  else if (l.includes("mastodon") || /^@[^@]+@/.test(label)) profile.mastodonUrl ||= url;
  else if (host.endsWith("youtube.com") || host === "youtu.be") profile.youtubeUrl ||= url;
  else if (host === "sessionize.com") profile.sessionizeUrl ||= url;
  else profile.websiteUrl ||= url;
}

// ─── Sessionize: https://sessionize.com/{slug} ───────────────────────────────

export function parseSessionizeProfile(html: string, pageUrl: string): ParsedProfile {
  const profile: ImportedProfile = { sessionizeUrl: pageUrl };
  // The full info card comes first; the compact sidebar repeats it, so take the first match.
  profile.fullName = first(html, /class="c-s-speaker-info__name">([\s\S]*?)<\/h1>/);
  profile.tagline = first(html, /class="c-s-speaker-info__tagline">([\s\S]*?)<\/p>/);
  profile.bioLong = first(html, /class="c-s-speaker-info__bio"[^>]*>([\s\S]*?)<\/div>/);
  const avatar = /class="c-s-speaker-info__avatar">\s*<img[^>]*src="([^"]+)"/.exec(html)?.[1];
  if (avatar?.startsWith("https://")) profile.headshotSquareUrl = decodeEntities(avatar);
  Object.assign(profile, splitLocation(first(html, /class="c-s-speaker-info__location">([\s\S]*?)<\/p>/)));

  const linksBlock = /c-s-speaker-info__group--links">([\s\S]*?)<\/ul>/.exec(html)?.[1] ?? "";
  for (const m of linksBlock.matchAll(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)) assignLink(profile, decodeEntities(m[1]), htmlToText(m[2]));

  const topicsBlock = />\s*Topics\s*<\/h3>\s*<ul class="c-s-tags">([\s\S]*?)<\/ul>/.exec(html)?.[1] ?? "";
  const topics = [...topicsBlock.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map((m) => htmlToText(m[1])).filter(Boolean);

  const sessionsBlock = html.slice(Math.max(0, html.indexOf('id="sessions"')));
  const talks: ImportedTalk[] = [];
  const seen = new Set<string>();
  for (const m of sessionsBlock.matchAll(/class="c-s-session__title">\s*<a href="([^"]+)">([\s\S]*?)<\/a>[\s\S]*?class="c-s-session__summary">([\s\S]*?)<\/p>/g)) {
    const href = decodeEntities(m[1]);
    const id = /\/(\d+)\/?$/.exec(href)?.[1] ?? href;
    if (seen.has(id)) continue;
    seen.add(id);
    talks.push({
      ref: `profile:${id}`,
      title: htmlToText(m[2]),
      abstractLong: htmlToText(m[3]),
      customFields: { sessionizeUrl: new URL(href, "https://sessionize.com").toString() },
    });
  }
  return { source: "sessionize", profile, talks, topics };
}

// ─── run.events: https://speakers.run.events/{slug} ──────────────────────────

export function parseRunEventsProfile(html: string, pageUrl: string): ParsedProfile {
  const profile: ImportedProfile = {};
  profile.fullName = first(html, /class="speaker-in-focus-title[^"]*">([\s\S]*?)<\/div>/);
  // Header card: company (bold), then title/role, then country.
  const card = /class="speaker-in-focus-title[\s\S]*?<\/div>([\s\S]*?)<div class="col-lg-5/.exec(html)?.[1] ?? "";
  profile.company = first(card, /<strong>([\s\S]*?)<\/strong>/);
  const h5s = [...card.matchAll(/<h5[^>]*>([\s\S]*?)<\/h5>/g)].map((m) => htmlToText(m[1])).filter(Boolean);
  if (h5s.length >= 2) {
    profile.jobTitle = h5s[0];
    profile.country = h5s.at(-1);
  } else if (h5s.length === 1) profile.country = h5s[0];
  profile.tagline = [profile.jobTitle, profile.company].filter(Boolean).join(", ");
  const photo = /<a href="\/[^"]+">\s*<picture>\s*<img[^>]*src="(https:\/\/cdn\.run\.events\/profile-images\/[^"]+)"/.exec(html)?.[1];
  if (photo) profile.headshotSquareUrl = photo;
  // Bio: the paragraph under the "talk to me about …" heading.
  const about = /<h2\s+class="mb-4">([\s\S]*?)<\/h2>\s*<p\s+class="fw-600 mb-0">([\s\S]*?)<\/p>/.exec(html);
  if (about) profile.bioLong = htmlToText(about[2]);
  const topics = about ? htmlToText(about[1]).replace(/^talk to me about\s*/i, "").split(/\s*(?:,|&|\band\b)\s*/).filter(Boolean) : [];

  const talks: ImportedTalk[] = [];
  const seen = new Set<string>();
  const portfolio = html.slice(Math.max(0, html.indexOf("Session Portfolio")));
  for (const m of portfolio.matchAll(/<a\s+class="h4[^"]*"\s+href="([^"]+)"\s*>([\s\S]*?)<\/a>\s*<div\s+class="d-flex flex-wrap gap-3">([\s\S]*?)<p\s+class="mb-0 session-text">([\s\S]*?)<\/p>/g)) {
    const href = decodeEntities(m[1]);
    const id = /\/([0-9a-f-]{36})\/?$/i.exec(href)?.[1] ?? href;
    if (seen.has(id)) continue;
    seen.add(id);
    const tags = [...m[3].matchAll(/class="badge[^"]*"\s*>([\s\S]*?)<\/div>/g)].map((t) => htmlToText(t[1])).filter(Boolean);
    talks.push({
      ref: `profile:${id}`,
      title: htmlToText(m[2]),
      abstractLong: htmlToText(m[4]),
      tags,
      customFields: { runEventsUrl: new URL(href, pageUrl).toString() },
    });
  }
  return { source: "runevents", profile, talks, topics };
}

// ─── URL handling ────────────────────────────────────────────────────────────

const SESSIONIZE_RESERVED = new Set(["app", "s", "api", "login", "register", "speakers", "organizers", "pricing", "features", "blog", "landing", "about", "contact", "privacy", "terms"]);

/**
 * Accepts only public profile URLs on the two supported sites, and normalises them.
 * Never accepts Sessionize's logged-in area (/app/...): we don't handle anyone's session.
 */
export function parseProfileUrl(input: string): { source: ProfileSource; url: string } {
  let u: URL;
  try {
    u = new URL(/^https?:\/\//i.test(input.trim()) ? input.trim() : `https://${input.trim()}`);
  } catch {
    throw new Error("That doesn't look like a URL.");
  }
  const host = u.hostname.toLowerCase().replace(/^www\./, "");
  const segments = u.pathname.split("/").filter(Boolean);
  const slug = segments[0] ?? "";
  if (host === "sessionize.com") {
    if (slug === "app") throw new Error("That's your private Sessionize dashboard. Use your public profile URL instead, e.g. https://sessionize.com/your-name.");
    if (!slug || segments.length !== 1 || SESSIONIZE_RESERVED.has(slug) || !/^[a-z0-9._-]+$/i.test(slug)) throw new Error("Use your public Sessionize profile URL, e.g. https://sessionize.com/your-name.");
    return { source: "sessionize", url: `https://sessionize.com/${slug}` };
  }
  if (host === "speakers.run.events") {
    if (!slug || !/^[a-z0-9._-]+$/i.test(slug)) throw new Error("Use your public run.events speaker URL, e.g. https://speakers.run.events/your-name.");
    return { source: "runevents", url: `https://speakers.run.events/${slug}` };
  }
  throw new Error("Paste a public profile URL from sessionize.com or speakers.run.events.");
}
