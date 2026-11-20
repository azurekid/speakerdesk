#!/usr/bin/env node
/**
 * Phone-sized screenshots of SpeakerDesk pages, signed in or not. Uses the locally installed
 * Google Chrome over the DevTools protocol — no npm dependencies.
 *
 *   node scripts/mobile-shots.mjs --out /tmp/shots --cookie "better-auth.session_token=…" / /events /dashboard
 *   node scripts/mobile-shots.mjs --base https://… --width 390 --height 844 /
 *   node scripts/mobile-shots.mjs --click "button[aria-label='Open menu']" /dashboard   # screenshot after a click
 *
 * For each page it also reports horizontal overflow (content wider than the screen) and
 * tap targets smaller than 40×40 px — the two most common mobile problems.
 */
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const argv = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const v = argv[i + 1];
  argv.splice(i, 2);
  return v;
};
const base = opt("base", "http://localhost:3000").replace(/\/+$/, "");
const out = opt("out", path.join(tmpdir(), "speakerdesk-shots"));
const cookie = opt("cookie", "");
const width = Number(opt("width", 390));
const height = Number(opt("height", 844));
const click = opt("click", "");
const dark = argv.includes("--dark") ? (argv.splice(argv.indexOf("--dark"), 1), true) : false;
const pages = argv.length ? argv : ["/"];
mkdirSync(out, { recursive: true });

const CHROME = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const port = 9300 + Math.floor(Math.random() * 500);
const chrome = spawn(CHROME, [...(CHROME.includes("headless") ? [] : ["--headless=new"]), `--remote-debugging-port=${port}`, "--disable-gpu", "--no-first-run", "--hide-scrollbars",
  // keep one renderer per tab and never throttle it, or navigation/screenshot calls can hang
  "--disable-features=site-per-process,IsolateOrigins", "--disable-site-isolation-trials",
  "--disable-renderer-backgrounding", "--disable-background-timer-throttling", "--disable-backgrounding-occluded-windows", `--user-data-dir=${mkdtempSync(path.join(tmpdir(), "sd-chrome-"))}`, "about:blank"], { stdio: "ignore" });

async function target() {
  for (let i = 0; i < 50; i++) {
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
const listeners = [];
ws.addEventListener("message", (e) => {
  const msg = JSON.parse(e.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(new Error(msg.error.message));
    else resolve(msg.result);
  } else if (msg.method) listeners.forEach((l) => l(msg));
});
const send = (method, params = {}, ms = 15000) =>
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

await send("Page.enable");
await send("Network.enable");
await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 2, mobile: true });
await send("Emulation.setTouchEmulationEnabled", { enabled: true });
await send("Network.setUserAgentOverride", { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1" });
if (dark) await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "dark" }] });
if (cookie) {
  for (const part of cookie.split(/;\s*/)) {
    const [name, ...rest] = part.split("=");
    await send("Network.setCookie", { name, value: rest.join("="), url: base });
  }
}

const report = [];
for (const p of pages) {
 try {
  await send("Page.navigate", { url: base + p });
  // Poll rather than trust load events: redirects and streaming make those race.
  for (let i = 0; i < 100; i++) {
    await new Promise((r) => setTimeout(r, 200));
    const ready = await send("Runtime.evaluate", { expression: `document.readyState === "complete" && !!document.body`, returnByValue: true }, 2000).then((r) => r.result?.value === true).catch(() => false);
    if (ready) break;
  }
  await new Promise((r) => setTimeout(r, 1500)); // let Suspense boundaries stream in
  if (click) {
    await evaluate(`document.querySelector(${JSON.stringify(click)})?.click()`);
    await new Promise((r) => setTimeout(r, 600));
  }
  const checks = await evaluate(`(() => {
    const vw = document.documentElement.clientWidth;
    const wide = [...document.querySelectorAll("body *")].filter((el) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.right <= vw + 1) return false;
      // ignore things inside deliberate horizontal scrollers
      for (let a = el.parentElement; a; a = a.parentElement) { const o = getComputedStyle(a).overflowX; if (o === "auto" || o === "scroll" || o === "hidden") return false; }
      return true;
    }).slice(0, 5).map((el) => el.tagName.toLowerCase() + (el.className && typeof el.className === "string" ? "." + el.className.split(" ").slice(0, 3).join(".") : ""));
    const small = [...document.querySelectorAll("a, button, input:not([type=hidden]), select, textarea, [role=button]")].filter((el) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return false;
      const s = getComputedStyle(el); if (s.visibility === "hidden") return false;
      return r.height < 32 || r.width < 32;
    }).length;
    return { scrollWidth: document.documentElement.scrollWidth, vw, wide, small };
  })()`);
  const fullHeight = Math.max(height, Math.min(Number(await evaluate("document.documentElement.scrollHeight")) || height, 4000));
  await send("Emulation.setDeviceMetricsOverride", { width, height: fullHeight, deviceScaleFactor: 2, mobile: true });
  await new Promise((r) => setTimeout(r, 300));
  const { data } = await send("Page.captureScreenshot", { format: "png" }, 60000);
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 2, mobile: true });
  const file = path.join(out, `${p.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "home"}${click ? "_clicked" : ""}${dark ? "_dark" : ""}.png`);
  writeFileSync(file, Buffer.from(data, "base64"));
  report.push({ page: p, file, overflowPx: checks.scrollWidth - checks.vw, overflowing: checks.wide, smallTapTargets: checks.small });
 } catch (e) {
  report.push({ page: p, error: String(e instanceof Error ? e.message : e) });
 }
}
console.log(JSON.stringify(report, null, 2));
ws.close();
chrome.kill();
