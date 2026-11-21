#!/usr/bin/env node
/**
 * Screenshots for the "What's new" page. Each entry in whats-new-shots.json becomes one JPEG in
 * public/whats-new/<id>.jpg, shot as the demo account for its role (see seed.mjs).
 *
 *   node scripts/demo/shoot.mjs                      # every shot, server on localhost:3100
 *   node scripts/demo/shoot.mjs schedule-builder     # only the named shots
 *   node scripts/demo/shoot.mjs --base http://localhost:3000
 *
 * Local demo data only. Uses the installed Google Chrome over the DevTools protocol (no npm
 * dependencies), like scripts/mobile-shots.mjs.
 */
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const argv = process.argv.slice(2);
const baseIdx = argv.indexOf("--base");
const base = (baseIdx === -1 ? "http://localhost:3100" : argv.splice(baseIdx, 2)[1]).replace(/\/+$/, "");
if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base)) {
  console.error(`Refusing to shoot ${base}: demo accounts are for local testing only.`);
  process.exit(1);
}
const only = new Set(argv);
const manifest = JSON.parse(readFileSync(path.join(here, "whats-new-shots.json"), "utf8"));
const ACCOUNTS = {
  organizer: "demo-organizer@example.com",
  reviewer: "demo-reviewer@example.com",
  speaker: "demo-speaker@example.com",
  "speaker-2": "demo-speaker-2@example.com",
  "speaker-3": "demo-speaker-3@example.com",
  sponsor: "demo-sponsor@example.com",
  anonymous: null,
};
const PASSWORD = "demo-pass-2027";
const outDir = path.join(root, "public/whats-new");
mkdirSync(outDir, { recursive: true });

// Sign in as each role once; the session cookie is reused for every shot of that role.
const cookies = {};
for (const [role, email] of Object.entries(ACCOUNTS)) {
  if (!email) continue;
  const res = await fetch(`${base}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: base },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  const setCookie = res.headers.getSetCookie().find((c) => c.startsWith("better-auth.session_token="));
  if (!res.ok || !setCookie) throw new Error(`Could not sign in as ${role} (${email}): ${res.status}. Run scripts/demo/seed.mjs first.`);
  cookies[role] = setCookie.split(";")[0].slice("better-auth.session_token=".length);
}

const CHROME = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const port = 9800 + Math.floor(Math.random() * 500);
const chrome = spawn(
  CHROME,
  [
    "--headless=new", `--remote-debugging-port=${port}`, "--disable-gpu", "--no-first-run", "--hide-scrollbars",
    "--disable-renderer-backgrounding", "--disable-background-timer-throttling", "--disable-backgrounding-occluded-windows",
    `--user-data-dir=${mkdtempSync(path.join(tmpdir(), "sd-shots-"))}`, "about:blank",
  ],
  { stdio: "ignore" },
);

async function target() {
  for (let i = 0; i < 60; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
      const page = list.find((t) => t.type === "page");
      if (page) return page.webSocketDebuggerUrl;
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("Chrome didn't start");
}

const ws = new WebSocket(await target());
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let seq = 0;
const pending = new Map();
ws.addEventListener("message", (e) => {
  const msg = JSON.parse(e.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(new Error(msg.error.message));
    else resolve(msg.result);
  }
});
const send = (method, params = {}, ms = 20000) =>
  new Promise((resolve, reject) => {
    const id = ++seq;
    const t = setTimeout(() => (pending.delete(id), reject(new Error(`${method} timed out`))), ms);
    pending.set(id, { resolve: (v) => (clearTimeout(t), resolve(v)), reject: (e) => (clearTimeout(t), reject(e)) });
    ws.send(JSON.stringify({ id, method, params }));
  });
const evaluate = async (expr) => {
  const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(`In-page error: ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}`);
  return r.result.value;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const host = new URL(base).hostname;

await send("Page.enable");
await send("Network.enable");

const results = [];
for (const shot of manifest.shots) {
  if (only.size && !only.has(shot.id)) continue;
  try {
    const width = shot.width ?? 1280;
    const height = shot.height ?? 900;
    await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 700 });
    await send("Network.clearBrowserCookies");
    if (cookies[shot.role]) {
      await send("Network.setCookie", { name: "better-auth.session_token", value: cookies[shot.role], domain: host, path: "/", httpOnly: true, sameSite: "Lax" });
    }
    await send("Page.navigate", { url: base + shot.path });
    for (let i = 0; i < 100; i++) {
      await sleep(200);
      const ready = await send("Runtime.evaluate", { expression: `document.readyState === "complete" && !!document.body`, returnByValue: true }, 2000)
        .then((r) => r.result?.value === true)
        .catch(() => false);
      if (ready) break;
    }
    await sleep(1500); // let Suspense boundaries stream in
    if (shot.wait) {
      for (let i = 0; i < 50; i++) {
        if (await evaluate(`!!document.querySelector(${JSON.stringify(shot.wait)})`)) break;
        await sleep(200);
      }
    }
    if (shot.click) {
      await evaluate(`document.querySelector(${JSON.stringify(shot.click)})?.click()`);
      await sleep(800);
    }
    // Position the target, then read its box in page coordinates.
    const box = await evaluate(`(() => {
      const sel = ${JSON.stringify(shot.selector ?? null)};
      const el = sel ? document.querySelector(sel) : null;
      if (sel && !el) return { missing: true };
      if (el) el.scrollIntoView({ block: "start" });
      const r = el ? el.getBoundingClientRect() : { left: 0, top: 0, width: ${width}, height: ${height} };
      return {
        x: Math.max(0, r.left + window.scrollX - 16),
        y: Math.max(0, r.top + window.scrollY - 16),
        width: Math.min(r.width + 32, ${width}),
        height: r.height + 32,
      };
    })()`);
    if (box.missing) throw new Error(`selector not found: ${shot.selector}`);
    const clip = { x: box.x, y: box.y, width: box.width, height: Math.min(box.height, shot.maxHeight ?? 1000), scale: 1 };
    await sleep(200);
    const { data } = await send("Page.captureScreenshot", { format: "jpeg", quality: 84, clip, captureBeyondViewport: true }, 60000);
    writeFileSync(path.join(outDir, `${shot.id}.jpg`), Buffer.from(data, "base64"));
    results.push({ id: shot.id, ok: true, size: `${Math.round(clip.width)}x${Math.round(clip.height)}` });
  } catch (e) {
    results.push({ id: shot.id, ok: false, error: String(e instanceof Error ? e.message : e) });
  }
}
for (const r of results) console.log(`${r.ok ? "ok  " : "FAIL"} ${r.id}${r.ok ? `  ${r.size}` : `  ${r.error}`}`);
ws.close();
chrome.kill();
if (results.some((r) => !r.ok)) process.exitCode = 1;
