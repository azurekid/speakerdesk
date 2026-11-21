import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * Fetch for user-supplied URLs (e.g. a self-hosted Pretalx instance).
 * Blocks requests to private, loopback and link-local addresses (incl. the
 * Azure IMDS endpoint 169.254.169.254) to prevent SSRF, refuses redirects,
 * and caps response size and time.
 */

const MAX_BYTES = 10 * 1024 * 1024;
const TIMEOUT_MS = 15_000;

export class SafeFetchError extends Error {}

function isPrivateV4(ip: string): boolean {
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 0 || a === 10 || a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // CGNAT
    (a === 169 && b === 254) ||            // link-local / cloud metadata
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224                               // multicast / reserved
  );
}

function isPrivateIp(ip: string): boolean {
  if (isIP(ip) === 4) return isPrivateV4(ip);
  const v6 = ip.toLowerCase();
  if (v6.startsWith("::ffff:")) return isPrivateV4(v6.slice(7));
  return (
    v6 === "::" || v6 === "::1" ||
    v6.startsWith("fc") || v6.startsWith("fd") || // unique local
    v6.startsWith("fe8") || v6.startsWith("fe9") || v6.startsWith("fea") || v6.startsWith("feb") // link-local
  );
}

export async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new SafeFetchError("That doesn't look like a valid URL.");
  }
  if (url.protocol !== "https:") throw new SafeFetchError("Only https:// URLs are supported.");
  if (url.username || url.password) throw new SafeFetchError("URLs with credentials are not allowed.");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => []);
  if (addresses.length === 0) throw new SafeFetchError(`Could not resolve ${host}.`);
  if (addresses.some((a) => isPrivateIp(a.address))) throw new SafeFetchError("That host is not reachable from SpeakerDesk.");
  return url;
}

/** Fetches a user-supplied public https URL with the guards above and returns the raw body. */
async function safeFetchBody(raw: string, init: { headers?: Record<string, string> }, accept: string): Promise<string> {
  const url = await assertPublicUrl(raw);
  const res = await fetch(url, {
    headers: { Accept: accept, "User-Agent": "SpeakerDesk-Importer/1.0", ...init.headers },
    redirect: "manual",
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (res.status >= 300 && res.status < 400) throw new SafeFetchError(`The server redirected (${res.status}); use the final URL instead.`);
  if (res.status === 401 || res.status === 403) throw new SafeFetchError("Access denied, check your API token.");
  if (res.status === 404) throw new SafeFetchError("Not found, check the URL / event slug.");
  if (!res.ok) throw new SafeFetchError(`Request failed with HTTP ${res.status}.`);

  const reader = res.body?.getReader();
  if (!reader) throw new SafeFetchError("Empty response.");
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES) {
      await reader.cancel();
      throw new SafeFetchError("Response too large.");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

export async function safeFetchJson<T = unknown>(raw: string, init: { headers?: Record<string, string> } = {}): Promise<T> {
  const body = await safeFetchBody(raw, init, "application/json");
  try {
    return JSON.parse(body) as T;
  } catch {
    throw new SafeFetchError("The response was not valid JSON.");
  }
}

/** For public HTML pages (e.g. a speaker's profile page). */
export async function safeFetchText(raw: string, init: { headers?: Record<string, string> } = {}): Promise<string> {
  return safeFetchBody(raw, init, "text/html,application/xhtml+xml");
}
