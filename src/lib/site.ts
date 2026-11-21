// Client-safe site constants for search engines and link previews.

/**
 * The one public address search engines should index. Known at build time (unlike
 * BETTER_AUTH_URL), so it can be used in static metadata. Other hosts redirect here (src/proxy.ts).
 */
export const SITE_URL = (process.env.SITE_URL || "https://speakerdesk.eu").replace(/\/+$/, "");
export const SITE_NAME = "SpeakerDesk";
export const SITE_TAGLINE = "Call for papers, speaker management and sponsorship for events";
export const SITE_DESCRIPTION =
  "Free platform for conference speakers and event organizers: keep your talks and bios in one place, submit to calls for papers, run your CfP, review proposals, build the programme and manage sponsors.";
/** Default image for link previews: a real stage photo bundled with the app. */
export const SITE_IMAGE = "/images/events/main-stage.jpg";

/** JSON-LD for a <script type="application/ld+json">. `<` is escaped so user text can't close the tag. */
export function jsonLd(data: object): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
