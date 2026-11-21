---
name: whats-new
description: Write a "What's new" entry for a SpeakerDesk change, with a screenshot of the feature. Use after adding or changing anything users can see (a feature, a visible improvement, a changed workflow), or when asked to update the What's new page.
---

# What's new: entry and screenshot

The public page `/whats-new` is built from `src/lib/whats-new.ts`. Every item has a screenshot,
made from the demo data so nothing personal appears.

## Steps

1. **Decide the audience.** `speakers`, `organizers`, `sponsors` or `everyone`. One entry per
   user-visible change. Skip refactors and fixes that change nothing a user can see.

2. **Write the item** at the top of the newest release in `RELEASES` (or add a new release at the
   top with today's date). Fields: `audience`, `title` (short), `body` (one or two plain sentences
   about what people can now do), optional `href` (where to try it), and `shot` (the id below).
   - No em dashes. Plain language. Describe the outcome, not the implementation.

3. **Add the screenshot to the manifest** `scripts/demo/whats-new-shots.json`:
   `{ "id": "<shot>", "role": "<organizer|speaker|speaker-2|speaker-3|sponsor|reviewer|anonymous>", "path": "/…", "selector": "<css, optional>", "maxHeight": 1000 }`
   - `role` is the demo account to shoot as (see `scripts/demo/seed.mjs`).
   - `path` uses the demo event `seed_evt_cloud` (public slug `cloud-summit-demo`) and the demo
     speakers' ids. Add data to `scripts/demo/seed.sql` if the feature has no demo content yet.
   - `selector` crops to one element; leave it out to shoot the top of the page. Add a
     `data-shot="…"` attribute to the element in the component when no good selector exists.
   - Use `click`, `wait` or `hover` when the feature sits behind a click or a state.

4. **Make the screenshot.** Start the local server with the demo data:
   ```bash
   npm run build
   PORT=3100 BETTER_AUTH_URL=http://localhost:3100 AUTH_EMAIL_PASSWORD=true AUTH_RATE_LIMIT=false npx next start
   node scripts/demo/seed.mjs            # only if the demo data is missing or changed
   node scripts/demo/shoot.mjs <shot-id> # writes public/whats-new/<shot-id>.jpg
   ```
   Open the JPEG and check it: the feature is visible, nothing is cut off, no real personal data.
   If it isn't right, adjust the manifest entry (selector, `click`, `maxHeight`) and shoot again.

5. **Check.** Run `node scripts/whats-new-check.mjs`. It fails when an item has no screenshot,
   a file is missing, a shot is not in the manifest, or the copy contains an em dash.

## Notes

- The screenshots are of local demo data. Re-run `shoot.mjs` after UI changes that affect a shot;
  every shot can be re-made with `node scripts/demo/shoot.mjs` (no ids = all).
- Never shoot a real account. The shooter only signs in with the demo accounts and only runs
  against localhost.
