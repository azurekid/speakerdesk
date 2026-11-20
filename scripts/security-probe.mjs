#!/usr/bin/env node
/**
 * Non-destructive black-box security probe for a SpeakerDesk deployment you own.
 * Maps to OWASP Top 10 (2021) / ASVS categories. No dependencies; sends a few dozen requests, no load.
 *
 *   node scripts/security-probe.mjs                         # http://localhost:3000
 *   node scripts/security-probe.mjs https://speakerdesk.example.com
 *   node scripts/security-probe.mjs <url> --json            # machine-readable findings
 *
 * Only point this at SpeakerDesk environments you are authorised to test.
 * Exit code: 0 = no HIGH/MEDIUM findings, 1 = at least one.
 */

const args = process.argv.slice(2);
const base = (args.find((a) => !a.startsWith("--")) ?? "http://localhost:3000").replace(/\/+$/, "");
const asJson = args.includes("--json");
const origin = new URL(base).origin;
const isHttps = base.startsWith("https://");
const EVIL = "https://evil.example";

const findings = [];
const passed = [];
const add = (severity, owasp, title, detail) => findings.push({ severity, owasp, title, detail });
const ok = (owasp, title) => passed.push({ owasp, title });

const req = (path, init = {}) =>
  fetch(base + path, { redirect: "manual", ...init, headers: { "user-agent": "speakerdesk-security-probe", ...init.headers } });

async function probe(fn) {
  try {
    await fn();
  } catch (e) {
    add("INFO", "-", "Probe error", e instanceof Error ? e.message : String(e));
  }
}

// ── A05 Security misconfiguration: response headers ───────────────────────────
await probe(async () => {
  const res = await req("/");
  const h = (n) => res.headers.get(n);
  const csp = h("content-security-policy") ?? "";
  if (!csp) add("MEDIUM", "A05", "No Content-Security-Policy", "Add a CSP (at least default-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'self').");
  else ok("A05", "Content-Security-Policy present");
  if (!csp.includes("frame-ancestors") && !h("x-frame-options"))
    add("MEDIUM", "A05", "Clickjacking: no frame-ancestors / X-Frame-Options", "Set `frame-ancestors 'none'` in the CSP or `X-Frame-Options: DENY`.");
  else ok("A05", "Framing restricted");
  if (isHttps && !h("strict-transport-security"))
    add("MEDIUM", "A02", "No Strict-Transport-Security", "Set `Strict-Transport-Security: max-age=31536000; includeSubDomains`.");
  else if (isHttps) ok("A02", "HSTS present");
  if (h("x-content-type-options") !== "nosniff") add("LOW", "A05", "No X-Content-Type-Options: nosniff", "Set it on every response.");
  else ok("A05", "nosniff present");
  if (!h("referrer-policy")) add("LOW", "A05", "No Referrer-Policy", "Use `strict-origin-when-cross-origin` (invite tokens live in URLs).");
  else ok("A05", "Referrer-Policy present");
  if (!h("permissions-policy")) add("LOW", "A05", "No Permissions-Policy", "e.g. `camera=(), microphone=(), geolocation=()`.");
  if (h("x-powered-by")) add("LOW", "A05", `Technology disclosure: X-Powered-By: ${h("x-powered-by")}`, "Set `poweredByHeader: false` in next.config.ts.");
  else ok("A05", "No X-Powered-By");
});

// ── A02 Transport: plain HTTP must not serve content ──────────────────────────
if (isHttps) {
  await probe(async () => {
    const http = base.replace(/^https:/, "http:");
    const res = await fetch(http + "/", { redirect: "manual" }).catch(() => null);
    if (res && res.status === 200) add("HIGH", "A02", "Site served over plain HTTP", "Container Apps ingress should have allowInsecure: false.");
    else ok("A02", "Plain HTTP not served");
  });
}

// ── A01 Broken access control: unauthenticated API access ─────────────────────
const protectedApis = [
  ["GET", "/api/export/json"],
  ["GET", "/api/export/csv"],
  ["GET", "/api/export/markdown"],
  ["GET", "/api/places?q=amsterdam"],
  ["GET", "/api/sessions/does-not-exist/markdown"],
  ["POST", "/api/upload/headshot"],
];
for (const [method, path] of protectedApis) {
  await probe(async () => {
    const res = await req(path, { method, headers: { origin } });
    const allowed = [401, 403, 404, 307, 308].includes(res.status);
    if (!allowed) add("HIGH", "A01", `${method} ${path} without a session returned ${res.status}`, "Every API route must call getCurrentUser()/requireUser() first.");
    else ok("A01", `${method} ${path} blocked signed out (${res.status})`);
  });
}
for (const path of ["/admin", "/admin/users", "/admin/outbox", "/admin/audit"]) {
  await probe(async () => {
    const res = await req(path);
    if (res.status === 200) add("HIGH", "A01", `${path} renders without a session`, "Admin pages must call requireAdmin().");
    else ok("A01", `${path} blocked signed out (${res.status})`);
  });
}

// ── A01 Open redirects ────────────────────────────────────────────────────────
const redirectProbes = [
  "/sign-in?next=//evil.example",
  "/sign-in?next=https://evil.example",
  "/api/account/continue?next=//evil.example",
  "/api/account/continue?next=/%2F%2Fevil.example",
  "/api/account/continue?next=/%5Cevil.example",
  "/api/account/view?role=speaker&next=//evil.example",
];
for (const path of redirectProbes) {
  await probe(async () => {
    const res = await req(path);
    const loc = res.headers.get("location");
    if (!loc) return ok("A01", `No redirect for ${path}`);
    const target = new URL(loc, base);
    if (target.origin !== origin)
      add(target.hostname.endsWith("evil.example") ? "HIGH" : "MEDIUM", "A01", `Redirect leaves the site: ${path} → ${target.href}`, "Build redirects from appUrl() and accept only same-origin relative paths.");
    else ok("A01", `Redirect stays on-site: ${path}`);
  });
}

// ── A07 / A01 Auth CSRF: Better Auth must reject foreign origins ──────────────
await probe(async () => {
  const res = await req("/api/auth/sign-in/email", {
    method: "POST",
    headers: { "content-type": "application/json", origin: EVIL },
    body: JSON.stringify({ email: "probe@example.invalid", password: "not-a-real-password" }),
  });
  if (res.status === 403) ok("A01", "Auth endpoint rejects foreign Origin (403)");
  else if (res.status === 404) ok("A07", "Email + password sign-in disabled");
  else add("HIGH", "A01", `Auth POST from foreign Origin returned ${res.status}`, "Better Auth's origin check must reject requests not from BETTER_AUTH_URL / trustedOrigins.");
});

// ── A07 Passcode sign-in must not create accounts or reveal which emails exist ──
await probe(async () => {
  const email = `probe-${Date.now()}@example.invalid`; // never registered, never receives mail
  const send = await req("/api/auth/email-otp/send-verification-otp", {
    method: "POST",
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify({ email, type: "sign-in" }),
  });
  if (send.status === 429) return ok("A07", "Passcode send is rate-limited (skipped enumeration check)");
  const body = await send.json().catch(() => ({}));
  if (send.status !== 200 || body.success !== true)
    add("MEDIUM", "A07", `Passcode request for an unknown email answered ${send.status} ${JSON.stringify(body)}`, "Must look identical to a known email (200 {success:true}) to prevent account enumeration.");
  else ok("A07", "Passcode request doesn't reveal whether the email exists");
  const verify = await req("/api/auth/sign-in/email-otp", {
    method: "POST",
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify({ email, otp: "000000" }),
  });
  if (verify.status === 200) add("HIGH", "A07", "Passcode sign-in created/signed in an unknown account", "Set emailOTP({ disableSignUp: true }).");
  else ok("A07", `Passcode sign-in for an unknown email refused (${verify.status})`);
});

// ── A05 CORS ──────────────────────────────────────────────────────────────────
for (const path of ["/api/auth/get-session", "/api/health"]) {
  await probe(async () => {
    const res = await req(path, { headers: { origin: EVIL } });
    const acao = res.headers.get("access-control-allow-origin");
    const creds = res.headers.get("access-control-allow-credentials");
    if (acao === "*" && creds === "true") add("HIGH", "A05", `CORS: ${path} allows any origin with credentials`, "Never combine * with credentials.");
    else if (acao === EVIL) add("HIGH", "A05", `CORS: ${path} reflects arbitrary Origin`, "Allow-list origins explicitly.");
    else ok("A05", `CORS not open on ${path}`);
  });
}

// ── A07 Brute force: is the sign-in endpoint rate-limited? ────────────────────
await probe(async () => {
  let limited = false;
  for (let i = 0; i < 12 && !limited; i++) {
    const res = await req("/api/auth/sign-in/email", {
      method: "POST",
      headers: { "content-type": "application/json", origin },
      body: JSON.stringify({ email: `probe-${i}@example.invalid`, password: "wrong-password-xx" }),
    });
    if (res.status === 404) return ok("A07", "Email + password sign-in disabled");
    if (res.status === 429) limited = true;
  }
  if (limited) ok("A07", "Sign-in is rate-limited (429 within 12 attempts)");
  else add("MEDIUM", "A07", "No rate limit seen on /api/auth/sign-in/email within 12 attempts", "Enable Better Auth rateLimit (storage: database for multi-replica) and/or a WAF rule on /api/auth/*.");
});

// ── A05 Sensitive files / error disclosure ────────────────────────────────────
for (const path of ["/.env", "/.git/config", "/.next/server/app-paths-manifest.json", "/prisma/schema.prisma", "/package.json"]) {
  await probe(async () => {
    const res = await req(path);
    const text = res.status === 200 ? await res.text() : "";
    if (res.status === 200 && text.length > 0 && !text.includes("<!DOCTYPE html")) add("HIGH", "A05", `${path} is downloadable`, "Make sure it is not copied into public/ or the image.");
    else ok("A05", `${path} not exposed`);
  });
}
await probe(async () => {
  const res = await req("/api/sessions/%00/markdown");
  const text = await res.text();
  if (/at .+\.(js|ts):\d+|PrismaClient|ECONNREFUSED|stack/i.test(text)) add("MEDIUM", "A05", "Error response leaks internals", text.slice(0, 200));
  else ok("A05", "No stack trace in error response");
});

// ── A08/A09: health endpoint must not leak config ─────────────────────────────
await probe(async () => {
  const res = await req("/api/health?deep=1");
  const text = await res.text();
  if (/postgres(ql)?:\/\/|password|secret|key=/i.test(text)) add("HIGH", "A09", "Health endpoint leaks configuration", text.slice(0, 200));
  else ok("A09", "Health endpoint discloses nothing sensitive");
});

// ── Report ────────────────────────────────────────────────────────────────────
const order = { HIGH: 0, MEDIUM: 1, LOW: 2, INFO: 3 };
findings.sort((a, b) => order[a.severity] - order[b.severity]);
if (asJson) {
  console.log(JSON.stringify({ target: base, findings, passed }, null, 2));
} else {
  console.log(`SpeakerDesk security probe: ${base}\n`);
  for (const f of findings) console.log(`[${f.severity.padEnd(6)}] ${f.owasp.padEnd(3)} ${f.title}\n           ${f.detail}`);
  console.log(`\n${findings.length} finding(s), ${passed.length} check(s) passed.`);
}
process.exit(findings.some((f) => f.severity === "HIGH" || f.severity === "MEDIUM") ? 1 : 0);
