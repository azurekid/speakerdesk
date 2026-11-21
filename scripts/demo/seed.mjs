#!/usr/bin/env node
/**
 * Creates the demo organizer, speakers and sponsor used for screenshots and manual testing.
 * Accounts are created through the real sign-up route; the SQL in seed.sql fills in the data.
 *
 *   node scripts/demo/seed.mjs                       # server on http://localhost:3100
 *   node scripts/demo/seed.mjs --base http://localhost:3000
 *
 * Refuses to run against anything but localhost. Re-running replaces the demo data.
 * Needs the local Postgres container from the run-local skill (speakerdesk-pg).
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const argv = process.argv.slice(2);
const baseArg = argv.indexOf("--base") !== -1 ? argv[argv.indexOf("--base") + 1] : "http://localhost:3100";
const base = baseArg.replace(/\/+$/, "");
if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base)) {
  console.error(`Refusing to seed ${base}: demo accounts are for local testing only.`);
  process.exit(1);
}

export const DEMO_PASSWORD = "demo-pass-2027";
export const DEMO_USERS = [
  { email: "demo-organizer@example.com", name: "Maya de Vries", role: "organizer" },
  { email: "demo-reviewer@example.com", name: "Jordan Reviewer", role: "reviewer" },
  { email: "demo-speaker@example.com", name: "Alex Rivera", role: "speaker" },
  { email: "demo-speaker-2@example.com", name: "Priya Nair", role: "speaker" },
  { email: "demo-speaker-3@example.com", name: "Sam Okafor", role: "speaker" },
  { email: "demo-speaker-4@example.com", name: "Lena Berg", role: "speaker" },
  { email: "demo-sponsor@example.com", name: "Chris Lindqvist", role: "sponsor" },
];

const here = path.dirname(fileURLToPath(import.meta.url));
const psql = (sql) => {
  const r = spawnSync("podman", ["exec", "-i", "speakerdesk-pg", "psql", "-U", "postgres", "-d", "speakerdesk", "-v", "ON_ERROR_STOP=1", "-q"], { input: sql, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`psql failed:\n${r.stderr || r.stdout}`);
  return r.stdout;
};

// 1. Remove the previous demo data (the event and sponsor org have fixed ids).
// Local only: the sign-up limiter would otherwise stop seeding after a few accounts.
psql(`DELETE FROM rate_limit;
DELETE FROM event WHERE slug = 'cloud-summit-demo';
DELETE FROM sponsor_org WHERE id = 'seed_org_north';
DELETE FROM "user" WHERE email LIKE 'demo-%@example.com';`);

// 2. Create the accounts through the real sign-up route.
for (const u of DEMO_USERS) {
  const res = await fetch(`${base}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: base },
    body: JSON.stringify({ email: u.email, password: DEMO_PASSWORD, name: u.name }),
  });
  if (!res.ok) throw new Error(`Sign-up failed for ${u.email}: ${res.status} ${await res.text()}`);
}

// 3. Fill in the data. {{U:email}} becomes the user's id.
const template = readFileSync(path.join(here, "seed.sql"), "utf8");
const sql = template.replace(/\{\{U:([^}]+)\}\}/g, (_, email) => `(SELECT id FROM "user" WHERE email = '${email}')`);
psql(sql);

console.log(`Demo data ready on ${base}. Sign in with the password "${DEMO_PASSWORD}":\n`);
for (const u of DEMO_USERS) console.log(`  ${u.role.padEnd(10)} ${u.email}`);
console.log(`\nEvent: ${base}/organize/seed_evt_cloud (Cloud Summit Demo, public page /events/cloud-summit-demo)`);
