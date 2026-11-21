// Badge artwork as a standalone SVG string, in the style of event badges on Credly (e.g. the
// Kusto Detective Agency "Call of the Cyber Duty" badge) with Azure Heroes colours. Pure and
// client-safe: the same output is used on pages, in previews and as the downloadable .svg.
//
// Layout (viewBox 200×200):
//   shape   — rounded top corners, fully round bottom; dark, with dots fading in from the edges
//   centre  — soft theme glow, thin white circle, the glowing icon
//   title   — event name (small), badge name (large, 1–2 lines) flanked by circuit traces
//   corners — lanyard ID card "I was there!" (top-left), calendar tile with the date (top-right)
// Every text line gets an explicit, computed width (textLength), so alignment never depends
// on which font the viewer happens to have.

import { BADGE_ICON_NODES } from "./badge-icons";
import { BADGE_THEMES, type BadgeTheme } from "./badges";

export type BadgeArtOptions = {
  icon: string;
  color: string;
  /** The badge name, e.g. "Speaker" — the big title. */
  label?: string;
  /** Event name — small line above the title. */
  eventName?: string;
  /** Event date — shown on the calendar tile. */
  date?: string | Date | null;
  /** Icon-only render for small sizes (no text, no corner elements). */
  compact?: boolean;
  /** Greyed out (declined/hidden). */
  muted?: boolean;
};

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!);
const r1 = (n: number) => Math.round(n * 10) / 10;

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Widest a title line may be (centred), leaving room for the circuit traces on both sides. */
const TITLE_MAX = 108;

const SHAPE = "M0 20 Q0 0 20 0 H180 Q200 0 200 20 V100 A100 100 0 0 1 0 100 Z";
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/** Approximate rendered width of bold uppercase text, in viewBox units. */
const textWidth = (s: string, size: number, spacing = 0) => [...s].reduce((w, ch) => w + (ch === " " ? 0.32 : /[IJ1.,'!:]/.test(ch) ? 0.34 : /[MW]/.test(ch) ? 0.9 : 0.68) * size, 0) + spacing * Math.max(0, s.length - 1);

/**
 * A text line centred on x=100 that never exceeds maxWidth: the font shrinks first, and
 * textLength pins the final width so circuit traces can be placed exactly beside it.
 */
function fittedText(s: string, y: number, opts: { max: number; size: number; min: number; spacing: number; fill: string; weight: number; opacity?: number }) {
  let size = opts.size;
  while (size > opts.min && textWidth(s, size, opts.spacing) > opts.max) size -= 0.5;
  const width = Math.min(textWidth(s, size, opts.spacing), opts.max);
  const svg = `<text x="100" y="${r1(y)}" text-anchor="middle" font-size="${size}" font-weight="${opts.weight}" letter-spacing="${opts.spacing}" fill="${opts.fill}"${opts.opacity ? ` opacity="${opts.opacity}"` : ""} textLength="${r1(width)}" lengthAdjust="spacingAndGlyphs">${esc(s)}</text>`;
  return { svg, width, size };
}

/** Split a title into one or two balanced lines. */
function titleLines(label: string): string[] {
  const words = label.toUpperCase().trim().split(/\s+/).filter(Boolean);
  if (words.join(" ").length <= 12 || words.length === 1) return [words.join(" ")];
  let best = 1;
  let bestDiff = Infinity;
  for (let i = 1; i < words.length; i++) {
    const diff = Math.abs(words.slice(0, i).join(" ").length - words.slice(i).join(" ").length);
    if (diff < bestDiff) [best, bestDiff] = [i, diff];
  }
  return [words.slice(0, best).join(" "), words.slice(best).join(" ")];
}

function iconSvg(name: string, cx: number, cy: number, size: number, color: string, glowId?: string) {
  const nodes = BADGE_ICON_NODES[name] ?? BADGE_ICON_NODES.award;
  const s = size / 24;
  const shapes = nodes.map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).map(([k, v]) => `${k}="${esc(String(v))}"`).join(" ")}/>`).join("");
  const g = (stroke: string, width: number, extra = "") =>
    `<g transform="translate(${r1(cx - size / 2)} ${r1(cy - size / 2)}) scale(${r1(s * 1000) / 1000})" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"${extra}>${shapes}</g>`;
  return (glowId ? g(color, 3.2, ` filter="url(#${glowId})" opacity="0.9"`) : "") + g("#ffffff", 1.9);
}

/** Circuit-board traces running from the white circle in towards the title. */
function circuit(y: number, gap: number, color: string) {
  // Ends 6 units before the title, never closer to the centre than the title lane allows.
  const inner = Math.min(100 - gap, 100 - TITLE_MAX / 2 - 4);
  const left = `M 18 ${y - 9} H 30 L 38 ${y} H ${r1(inner)}`;
  const leftB = `M 24 ${y + 8} H 34 L 39 ${y + 3}`;
  // Mirror every x coordinate (the number after M, H or L) around the centre line.
  const mirror = (d: string) => d.replace(/([MHL]) ([\d.]+)/g, (_, c, x) => `${c} ${r1(200 - Number(x))}`);
  const nodes = [[18, y - 9], [24, y + 8], [182, y - 9], [176, y + 8]].map(([x, yy]) => `<circle cx="${x}" cy="${yy}" r="1.5" fill="${color}"/>`).join("");
  return `<g fill="none" stroke="${color}" stroke-width="0.9" opacity="0.8"><path d="${left}"/><path d="${leftB}"/><path d="${mirror(left)}"/><path d="${mirror(leftB)}"/></g>${nodes}`;
}

/** White or the theme's dark ink, whichever reads better on `bg` (simple luminance check). */
function readableOn(bg: string, dark: string) {
  const n = parseInt(bg.replace("#", ""), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 150 ? dark : "#ffffff";
}

function calendar(date: Date, t: BadgeTheme) {
  const md = `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}`;
  const year = String(date.getUTCFullYear());
  return `<g transform="translate(146 6) rotate(4)">
<rect x="0" y="4" width="48" height="44" rx="7" fill="${t.ring[1]}"/>
<rect x="5" y="15" width="38" height="29" rx="3.5" fill="#f1f5f9"/>
<circle cx="15" cy="10" r="2.4" fill="${t.band}"/><circle cx="33" cy="10" r="2.4" fill="${t.band}"/>
<rect x="14" y="0" width="2" height="10" rx="1" fill="${t.band}"/><rect x="32" y="0" width="2" height="10" rx="1" fill="${t.band}"/>
<text x="24" y="27.5" text-anchor="middle" font-size="9" font-weight="800" fill="${t.band}" textLength="${r1(Math.min(textWidth(md, 9), 33))}" lengthAdjust="spacingAndGlyphs">${md}</text>
<text x="24" y="40" text-anchor="middle" font-size="11" font-weight="900" fill="${t.band}" textLength="${r1(Math.min(textWidth(year, 11), 33))}" lengthAdjust="spacingAndGlyphs">${year}</text>
</g>`;
}

function idCard(t: BadgeTheme) {
  return `<g transform="translate(8 2) rotate(-9 24 30)">
<path d="M18 -6 L22 8 M30 -6 L26 8" stroke="#cbd5e1" stroke-width="4" stroke-linecap="round"/>
<rect x="2" y="6" width="44" height="54" rx="4" fill="#94a3b8"/>
<rect x="5" y="12" width="38" height="45" rx="2.5" fill="#f8fafc"/>
<rect x="19" y="8" width="10" height="2.6" rx="1.3" fill="${t.band}"/>
<circle cx="24" cy="26" r="9.5" fill="${t.band}" stroke="${t.ring[0]}" stroke-width="2"/>
<circle cx="24" cy="23.5" r="3.4" fill="#f8fafc"/><path d="M17.5 32.2 Q24 25.5 30.5 32.2" fill="#f8fafc"/>
<rect x="5" y="41" width="38" height="12" fill="${t.ring[0]}"/>
<text x="24" y="49.5" text-anchor="middle" font-size="7" font-weight="800" fill="${readableOn(t.ring[0], t.band)}" textLength="31" lengthAdjust="spacingAndGlyphs">I was there!</text>
</g>`;
}

export function badgeSvg({ icon, color, label = "", eventName = "", date, compact = false, muted = false }: BadgeArtOptions): string {
  const t: BadgeTheme = BADGE_THEMES[color as keyof typeof BADGE_THEMES] ?? BADGE_THEMES.sky;
  const detailed = !compact && Boolean(label || eventName);
  const id = `b${hash(`${icon}|${color}|${label}|${eventName}|${String(date ?? "")}|${compact}|${detailed}`).toString(36)}`;
  const when = date ? new Date(date) : null;
  const glowColor = t.ring[0];

  const defs = `<defs>
<clipPath id="${id}-shape"><path d="${SHAPE}"/></clipPath>
<linearGradient id="${id}-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${t.sky[0]}"/><stop offset="1" stop-color="${t.band}"/></linearGradient>
<radialGradient id="${id}-glow" cx="100" cy="${detailed ? 74 : 100}" r="${detailed ? 62 : 80}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${glowColor}" stop-opacity="0.55"/><stop offset="0.55" stop-color="${glowColor}" stop-opacity="0.14"/><stop offset="1" stop-color="${glowColor}" stop-opacity="0"/></radialGradient>
<pattern id="${id}-dots" width="7" height="7" patternUnits="userSpaceOnUse"><circle cx="3.5" cy="3.5" r="0.85" fill="${glowColor}"/></pattern>
<radialGradient id="${id}-fade" cx="100" cy="100" r="110" gradientUnits="userSpaceOnUse"><stop offset="0.62" stop-color="#000"/><stop offset="1" stop-color="#fff"/></radialGradient>
<mask id="${id}-edge"><rect width="200" height="200" fill="url(#${id}-fade)"/></mask>
<filter id="${id}-blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.2"/></filter>
${muted ? `<filter id="${id}-grey"><feColorMatrix type="saturate" values="0"/></filter>` : ""}
</defs>`;

  const base = `<g clip-path="url(#${id}-shape)">
<rect width="200" height="200" fill="url(#${id}-bg)"/>
${compact ? "" : `<rect width="200" height="200" fill="url(#${id}-dots)" mask="url(#${id}-edge)" opacity="0.9"/>`}
<rect width="200" height="200" fill="url(#${id}-glow)"/>
</g>
<circle cx="100" cy="100" r="${detailed ? 88 : 86}" fill="none" stroke="#ffffff" stroke-width="${compact ? 2.2 : 1.3}" opacity="0.9"/>`;

  let content: string;
  if (!detailed) {
    content = iconSvg(icon, 100, 100, compact ? 96 : 82, glowColor, compact ? undefined : `${id}-blur`);
  } else {
    const parts: string[] = [iconSvg(icon, 100, 70, 48, glowColor, `${id}-blur`)];
    // Event name: small, wide-spaced line.
    if (eventName) parts.push(fittedText(eventName.toUpperCase(), 110, { max: 118, size: 8.5, min: 5.5, spacing: 1.6, fill: "#ffffff", weight: 700, opacity: 0.92 }).svg);
    // Badge name: big; one or two balanced lines.
    const lines = titleLines(label || "Badge");
    const big = lines.length === 1 ? { y: [138], size: 25, min: 12 } : { y: [131, 153], size: 19, min: 11 };
    let widest = 0;
    lines.forEach((line, i) => {
      // Titles stay inside x 46–154; the circuit traces own the lanes outside that.
      const f = fittedText(line, big.y[i], { max: TITLE_MAX, size: big.size, min: big.min, spacing: 0.6, fill: t.text, weight: 900 });
      widest = Math.max(widest, f.width);
      parts.push(f.svg);
    });
    // Circuit traces end just outside the widest title line.
    const traceY = lines.length === 1 ? 129 : 135;
    parts.unshift(circuit(traceY, widest / 2 + 7, glowColor));
    // Small wordmark where Credly badges show the issuer/sponsors.
    parts.push(`<text x="100" y="171" text-anchor="middle" font-size="6" font-weight="700" letter-spacing="2.4" fill="#ffffff" opacity="0.55" textLength="64" lengthAdjust="spacingAndGlyphs">SPEAKERDESK</text>`);
    // Corner elements break out over the circle, like the ID card and calendar on the reference.
    parts.push(idCard(t));
    if (when && !Number.isNaN(when.getTime())) parts.push(calendar(when, t));
    content = parts.join("\n");
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-2 -4 204 206" role="img" aria-label="${esc(label || "Badge")}" font-family="'Geist', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif">
${defs}
<g${muted ? ` filter="url(#${id}-grey)" opacity="0.55"` : ""}>
${base}
${content}
</g>
</svg>`;
}
