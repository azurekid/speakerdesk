#!/usr/bin/env node
/**
 * Smoke test for a running SpeakerDesk (local or production). No dependencies.
 *
 *   node scripts/smoke.mjs                                  # http://localhost:3000
 *   node scripts/smoke.mjs https://speakerdesk.example.com
 *   node scripts/smoke.mjs <url> --expect-password          # fail if email + password sign-in is hidden
 *   node scripts/smoke.mjs <url> --signup                   # also create a throwaway account and follow the post-login redirect
 *
 * --signup writes a user (smoke+<timestamp>@example.invalid). Use it locally; on production only when you mean to.
 * Exit code 0 = all checks passed.
 */

const args = process.argv.slice(2);
const base = (args.find((a) => !a.startsWith("--")) ?? "http://localhost:3000").replace(/\/+$/, "");
const flags = new Set(args.filter((a) => a.startsWith("--")));
const origin = new URL(base).origin;

let failures = 0;
const pass = (name, detail = "") => console.log(`  ok    ${name}${detail ? `  (${detail})` : ""}`);
const fail = (name, detail) => {
  failures++;
  console.log(`  FAIL  ${name}\n        ${detail}`);
};

async function get(path, init = {}) {
  return fetch(base + path, { redirect: "manual", ...init, headers: { "user-agent": "speakerdesk-smoke", ...init.headers } });
}

async function check(name, fn) {
  try {
    const detail = await fn();
    pass(name, detail);
  } catch (e) {
    fail(name, e instanceof Error ? e.message : String(e));
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

/** A redirect must stay on the public origin (catches request.url → https://0.0.0.0:3000). */
function assertRedirect(res, expectedPath) {
  assert(res.status >= 300 && res.status < 400, `expected a redirect, got ${res.status}`);
  const loc = res.headers.get("location") ?? "";
  const target = new URL(loc, base);
  assert(target.origin === origin, `redirects off-site to ${target.origin} (expected ${origin}) — redirects must be built from appUrl(), not request.url`);
  assert(target.pathname === expectedPath, `redirects to ${target.pathname}, expected ${expectedPath}`);
  return `→ ${target.pathname}${target.search}`;
}

console.log(`SpeakerDesk smoke test: ${base}\n`);

console.log("Health");
await check("GET /api/health", async () => {
  const res = await get("/api/health");
  assert(res.status === 200, `status ${res.status}`);
});
await check("GET /api/health?deep=1 (database)", async () => {
  const res = await get("/api/health?deep=1");
  const body = await res.json().catch(() => ({}));
  assert(res.status === 200 && body.database === "up", `status ${res.status}, body ${JSON.stringify(body)}`);
});

console.log("\nAuth");
await check("GET /api/auth/get-session (Better Auth configured)", async () => {
  const res = await get("/api/auth/get-session");
  const text = await res.text();
  assert(res.status === 200, `status ${res.status}: ${text.slice(0, 200)} — check BETTER_AUTH_URL / BETTER_AUTH_SECRET in the container's env`);
});
await check("sign-in page lists sign-in methods", async () => {
  const res = await get("/sign-in");
  const html = await res.text();
  assert(res.status === 200, `status ${res.status}`);
  const hasPassword = html.includes('type="password"');
  if (flags.has("--expect-password")) assert(hasPassword, "no password field — AUTH_EMAIL_PASSWORD must be lowercase \"true\" in production");
  return hasPassword ? "email + password shown" : "passcode only";
});

console.log("\nPublic pages");
for (const path of ["/", "/events", "/speakers", "/sign-in", "/terms", "/privacy"]) {
  await check(`GET ${path}`, async () => {
    const res = await get(path);
    assert(res.status === 200, `status ${res.status}`);
  });
}

console.log("\nProtected pages redirect to sign-in on the public origin");
for (const path of ["/dashboard", "/onboarding", "/organize", "/admin", "/organizers"]) {
  await check(`GET ${path} (signed out)`, async () => assertRedirect(await get(path), "/sign-in"));
}
await check("GET /api/account/continue (signed out)", async () => assertRedirect(await get("/api/account/continue"), "/sign-in"));

if (flags.has("--signup")) {
  console.log("\nSign-up flow");
  const email = `smoke+${Date.now()}@example.invalid`;
  let cookie = "";
  await check(`sign up ${email}`, async () => {
    const res = await get("/api/auth/sign-up/email", {
      method: "POST",
      headers: { "content-type": "application/json", origin },
      body: JSON.stringify({ email, password: `Smoke-${crypto.randomUUID()}`, name: "Smoke Test" }),
    });
    const text = await res.text();
    assert(res.status === 200, `status ${res.status}: ${text.slice(0, 200)} — is email + password sign-in enabled?`);
    cookie = (res.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
    assert(cookie, "no session cookie returned");
  });
  if (cookie) {
    await check("post-login router sends a new account to /onboarding", async () =>
      assertRedirect(await get("/api/account/continue", { headers: { cookie } }), "/onboarding"));
    for (const path of ["/", "/events"]) {
      await check(`GET ${path} (signed in) shows Dashboard, not Sign in`, async () => {
        const html = await (await get(path, { headers: { cookie } })).text();
        assert(html.includes(">Dashboard</a>") && !html.includes(">Sign in</a>"), "header still offers Sign in to a signed-in user");
      });
    }
    await check("GET /onboarding (signed in)", async () => {
      const res = await get("/onboarding", { headers: { cookie } });
      assert(res.status === 200, `status ${res.status}`);
    });
  }
}

console.log(failures ? `\n${failures} check(s) failed.` : "\nAll checks passed.");
process.exit(failures ? 1 : 0);
