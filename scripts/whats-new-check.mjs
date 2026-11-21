#!/usr/bin/env node
/**
 * Checks the "What's new" content before it ships:
 *  - every release item has a `shot`, and public/whats-new/<shot>.jpg exists
 *  - every shot has an entry in scripts/demo/whats-new-shots.json (so it can be re-made)
 *  - no em dashes in the copy (house style)
 *  - releases are newest first
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(path.join(root, "src/lib/whats-new.ts"), "utf8");
const manifest = JSON.parse(readFileSync(path.join(root, "scripts/demo/whats-new-shots.json"), "utf8"));
const shotIds = new Set(manifest.shots.map((s) => s.id));

const problems = [];
const items = [...source.matchAll(/\{ audience: "(\w+)", title: "([^"]+)"[^\n]*\},?/g)];
const shots = [...source.matchAll(/shot: "([^"]+)"/g)].map((m) => m[1]);
const withShot = new Set(shots);

for (const m of items) {
  const [line, , title] = m;
  if (!/shot: "/.test(line)) problems.push(`"${title}" has no screenshot (add shot: "<id>")`);
}
if (items.length !== shots.length) problems.push(`${items.length} items but ${shots.length} shots: every item needs exactly one shot`);
for (const id of withShot) {
  if (!existsSync(path.join(root, "public/whats-new", `${id}.jpg`))) problems.push(`missing screenshot public/whats-new/${id}.jpg (run scripts/demo/shoot.mjs ${id})`);
  if (!shotIds.has(id)) problems.push(`shot "${id}" is not in scripts/demo/whats-new-shots.json`);
}
if (source.includes("—")) problems.push("em dash (—) in src/lib/whats-new.ts: use a comma, colon or full stop");

const dates = [...source.matchAll(/date: "(\d{4}-\d{2}-\d{2})"/g)].map((m) => m[1]);
for (let i = 1; i < dates.length; i++) if (dates[i] > dates[i - 1]) problems.push(`release ${dates[i]} is listed after ${dates[i - 1]}: newest first`);

if (problems.length) {
  for (const p of problems) console.error(`✗ ${p}`);
  process.exit(1);
}
console.log(`What's new: ${items.length} items, all with a screenshot. OK.`);
