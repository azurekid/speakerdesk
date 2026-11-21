// Badge artwork as a standalone SVG string: a round patch in the spirit of conference badges
// on Credly, styled after Azure Heroes' retro/synthwave look. Pure and client-safe, so the
// same output is used on pages, in previews and as a downloadable .svg file.
//
// Layout (viewBox 200×200): dark outer band with curved text (event on top, badge name at the
// bottom) → gradient ring → night sky with stars, a striped retro sun and a perspective grid →
// the badge icon in the middle.

import { BADGE_ICON_NODES } from "./badge-icons";
import { BADGE_THEMES, type BadgeTheme } from "./badges";

export type BadgeArtOptions = {
  icon: string;
  color: string;
  /** Large text along the bottom of the band, e.g. "SPEAKER". */
  label?: string;
  /** Small text along the top of the band, e.g. "CLOUD ONLINE • 2027". */
  topText?: string;
  /** Drop the scene details (stars, grid, text) for tiny renders. */
  compact?: boolean;
  /** Greyed out (declined/hidden). */
  muted?: boolean;
};

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!);

/** Small deterministic hash: stable ids and star positions for the same badge. */
function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
function rng(seed: number) {
  let x = seed || 1;
  return () => ((x = Math.imul(x ^ (x >>> 15), 2246822507) ^ Math.imul(x ^ (x >>> 13), 3266489909)), (x >>> 0) / 4294967296);
}

function icon(name: string, cx: number, cy: number, size: number, stroke: string, outline: string) {
  const nodes = BADGE_ICON_NODES[name] ?? BADGE_ICON_NODES.award;
  const s = size / 24;
  const shapes = nodes.map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).map(([k, v]) => `${k}="${esc(String(v))}"`).join(" ")}/>`).join("");
  const g = (color: string, width: number) =>
    `<g transform="translate(${cx - size / 2} ${cy - size / 2}) scale(${s})" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round">${shapes}</g>`;
  // A thick dark stroke underneath makes the icon read like an outlined sticker.
  return g(outline, 4.2) + g(stroke, 2);
}

export function badgeSvg({ icon: iconName, color, label = "", topText = "", compact = false, muted = false }: BadgeArtOptions): string {
  const t: BadgeTheme = BADGE_THEMES[color as keyof typeof BADGE_THEMES] ?? BADGE_THEMES.violet;
  const id = `b${hash(`${iconName}|${color}|${label}|${topText}|${compact}`).toString(36)}`;
  const rand = rng(hash(id));
  const withText = !compact && (label || topText);
  // Outer band only needs to be wide when it carries text.
  const R = { outer: 99, ring: withText ? 79 : 92, disc: withText ? 72 : 84 };

  const stars = compact
    ? ""
    : Array.from({ length: 14 }, () => {
        const a = rand() * Math.PI * 2;
        const d = rand() * (R.disc - 12);
        const x = 100 + Math.cos(a) * d;
        const y = 100 + Math.sin(a) * d * 0.6 - 18;
        const r = 0.6 + rand() * 1.3;
        return y < 108 ? `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="#fff" opacity="${(0.5 + rand() * 0.5).toFixed(2)}"/>` : "";
      }).join("") +
      // two four-point sparkles
      [[62, 64, 5], [140, 56, 4]].map(([x, y, s]) => `<path d="M${x} ${y - s}L${x + s * 0.28} ${y - s * 0.28}L${x + s} ${y}L${x + s * 0.28} ${y + s * 0.28}L${x} ${y + s}L${x - s * 0.28} ${y + s * 0.28}L${x - s} ${y}L${x - s * 0.28} ${y - s * 0.28}Z" fill="#fff"/>`).join("");

  // Retro sun: a gradient disc sliced by horizontal gaps that widen towards the horizon.
  const horizon = 128;
  // Compact renders are tiny: a smaller sun so the icon carries the badge.
  const sunR = withText ? 30 : compact ? 26 : 34;
  const sunCy = horizon - 2;
  const gaps = compact ? "" : [0, 1, 2, 3, 4].map((i) => `<rect x="60" y="${sunCy - 4 - i * 6.5}" width="80" height="${1.2 + i * 0.5}" fill="url(#${id}-sky)"/>`).join("");

  // Perspective grid on the floor below the horizon.
  const floor = compact
    ? ""
    : (() => {
        const lines: string[] = [];
        for (let i = -6; i <= 6; i++) lines.push(`<line x1="${100 + i * 4}" y1="${horizon}" x2="${100 + i * 30}" y2="200"/>`);
        for (let i = 1; i <= 6; i++) {
          const y = horizon + Math.pow(i / 6, 1.8) * (200 - horizon);
          lines.push(`<line x1="0" y1="${y.toFixed(1)}" x2="200" y2="${y.toFixed(1)}"/>`);
        }
        return `<rect x="0" y="${horizon}" width="200" height="${200 - horizon}" fill="${t.floor}"/><g stroke="${t.grid}" stroke-width="0.9" opacity="0.85">${lines.join("")}</g>`;
      })();

  // Curved text paths in the middle of the outer band.
  const textR = (R.outer + R.ring) / 2 + 0.5;
  const top = esc(topText.toUpperCase());
  const bottom = esc(label.toUpperCase());
  const bottomSize = bottom.length > 18 ? 11 : bottom.length > 13 ? 13 : 15;
  const text = withText
    ? `<path id="${id}-top" d="M ${100 - textR} 100 A ${textR} ${textR} 0 0 1 ${100 + textR} 100" fill="none"/>` +
      `<path id="${id}-bot" d="M ${100 - textR + 3} 100 A ${textR - 3} ${textR - 3} 0 0 0 ${100 + textR - 3} 100" fill="none"/>` +
      (top ? `<text font-size="${top.length > 26 ? 8.5 : 10}" font-weight="800" letter-spacing="1.6" fill="${t.text}" text-anchor="middle" dominant-baseline="middle"><textPath href="#${id}-top" startOffset="50%">${top}</textPath></text>` : "") +
      (bottom ? `<text font-size="${bottomSize}" font-weight="900" letter-spacing="1.2" fill="${t.text}" text-anchor="middle" dominant-baseline="middle"><textPath href="#${id}-bot" startOffset="50%">${bottom}</textPath></text>` : "")
    : "";

  const stops = (cs: readonly string[]) => cs.map((c, i) => `<stop offset="${(i / (cs.length - 1)) * 100}%" stop-color="${c}"/>`).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" role="img" aria-label="${esc(label || "Badge")}" font-family="'Geist', 'Segoe UI', system-ui, -apple-system, sans-serif">
<defs>
<linearGradient id="${id}-ring" x1="0" y1="0" x2="1" y2="1">${stops(t.ring)}</linearGradient>
<linearGradient id="${id}-sky" gradientUnits="userSpaceOnUse" x1="0" y1="20" x2="0" y2="140">${stops(t.sky)}</linearGradient>
<linearGradient id="${id}-sun" x1="0" y1="0" x2="0" y2="1">${stops(t.sun)}</linearGradient>
<clipPath id="${id}-disc"><circle cx="100" cy="100" r="${R.disc}"/></clipPath>
${muted ? `<filter id="${id}-grey"><feColorMatrix type="saturate" values="0"/></filter>` : ""}
</defs>
<g${muted ? ` filter="url(#${id}-grey)" opacity="0.55"` : ""}>
<circle cx="100" cy="100" r="${R.outer}" fill="${t.band}"/>
<circle cx="100" cy="100" r="${R.outer - 1.5}" fill="none" stroke="${t.ring[0]}" stroke-width="1" opacity="0.5"/>
${text}
<circle cx="100" cy="100" r="${R.ring}" fill="url(#${id}-ring)"/>
<g clip-path="url(#${id}-disc)">
<rect width="200" height="200" fill="url(#${id}-sky)"/>
${stars}
<circle cx="100" cy="${sunCy}" r="${sunR}" fill="url(#${id}-sun)"/>
${gaps}
${floor}
</g>
<circle cx="100" cy="100" r="${R.disc}" fill="none" stroke="${t.band}" stroke-width="2.5"/>
${icon(iconName, 100, withText ? 98 : compact ? 100 : 96, withText ? 50 : compact ? 96 : 62, t.icon, t.band)}
</g>
</svg>`;
}
