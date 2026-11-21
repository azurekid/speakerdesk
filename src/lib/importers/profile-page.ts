import "server-only";
import { SafeFetchError, safeFetchText } from "@/lib/safe-fetch";
import { type ParsedProfile, parseProfileUrl, parseRunEventsProfile, parseSessionizeProfile } from "./profile-parsers";

export class ProfilePageError extends Error {}

/**
 * Reads a speaker's *public* profile page on Sessionize or run.events. No login, no cookies:
 * only what the speaker has chosen to show publicly is imported.
 */
export async function fetchProfilePage(input: string): Promise<ParsedProfile & { url: string }> {
  let target: ReturnType<typeof parseProfileUrl>;
  try {
    target = parseProfileUrl(input);
  } catch (e) {
    throw new ProfilePageError(e instanceof Error ? e.message : "Invalid URL.");
  }
  let html: string;
  try {
    html = await safeFetchText(target.url);
  } catch (e) {
    const notFound = e instanceof SafeFetchError && /404|HTTP 5\d\d/.test(e.message);
    throw new ProfilePageError(
      notFound
        ? `No public profile found at ${target.url}. Check the address, and that your profile is public${target.source === "runevents" ? " in the run.events speaker directory" : ""}.`
        : `Couldn't load ${target.url}: ${e instanceof Error ? e.message : "unknown error"}`,
    );
  }
  const parsed = target.source === "sessionize" ? parseSessionizeProfile(html, target.url) : parseRunEventsProfile(html, target.url);
  if (!parsed.profile.fullName && parsed.talks.length === 0) throw new ProfilePageError("That page doesn't look like a speaker profile.");
  return { ...parsed, url: target.url };
}
