# SpeakerDesk: working rules

These apply to every change in this repo. `AGENTS.md` covers Next.js specifics.

## What's new

- Any change users can see (a feature, a visible improvement, a changed workflow) gets a
  "What's new" entry in `src/lib/whats-new.ts` before the work is called done. Internal changes,
  refactors and fixes that change nothing visible do not.
- Every entry has a screenshot. Add the shot to `scripts/demo/whats-new-shots.json`, run
  `node scripts/demo/shoot.mjs <id>`, and look at the result before using it.
- Use the `whats-new` skill for the copy and the screenshot. Run `node scripts/whats-new-check.mjs` before committing.

## Copy

- No em dashes (—) in site text, emails or release notes. Use commas, colons or full stops.
- Plain language. Say what people can do now.

## Local demo data

- `node scripts/demo/seed.mjs` creates demo accounts and an event (password `demo-pass-2027`).
  It refuses anything but localhost. Screenshots need a running local server, started with
  `AUTH_RATE_LIMIT=false` so the sign-up limiter doesn't stop seeding.
