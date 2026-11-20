/**
 * The public origin of the site (BETTER_AUTH_URL).
 *
 * Use this, not `request.url`, to build redirect targets: behind the container ingress the server
 * listens on HOSTNAME=0.0.0.0, so `request.url` would point at https://0.0.0.0:3000.
 */
export function appUrl() {
  return (process.env.BETTER_AUTH_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}
