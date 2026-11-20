/**
 * The public origin of the site (BETTER_AUTH_URL).
 *
 * Use this, not `request.url`, to build redirect targets: behind the container ingress the server
 * listens on HOSTNAME=0.0.0.0, so `request.url` would point at https://0.0.0.0:3000.
 */
export function appUrl() {
  return (process.env.BETTER_AUTH_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

/**
 * A user-supplied `next` path, or null if it could leave the site.
 * Checks the *resolved* URL, because `new URL()` treats `\` and tabs like `/`:
 * a string check for "//" alone lets `/\evil.example` through as https://evil.example.
 */
export function safeNextPath(raw: string | null | undefined): string | null {
  if (!raw || !raw.startsWith("/")) return null;
  const base = appUrl();
  try {
    const url = new URL(raw, base);
    if (url.origin !== new URL(base).origin) return null;
    return url.pathname + url.search + url.hash;
  } catch {
    return null;
  }
}
