---
name: smoke-test
description: Smoke-test a running SpeakerDesk instance (local dev server or the Azure production URL) — health, database, Better Auth config, public pages, sign-in redirects staying on the public origin, and optionally a full sign-up → onboarding flow. Use after a deploy, after changing auth/redirect/routing code, or when the user reports "login doesn't work", "redirected to the wrong URL", "site is down".
---

# Smoke test

The script is `scripts/smoke.mjs` (Node built-ins only, no install needed).

```bash
node scripts/smoke.mjs                                   # http://localhost:3000
node scripts/smoke.mjs <url> --expect-password           # fail if email + password sign-in is hidden
node scripts/smoke.mjs <url> --signup                    # also create a throwaway account
```

## Which URL

- **Local:** start the app with the `run-local` skill, then use the default.
- **Production:** the Container App's URL, or `PUBLIC_URL` when a custom domain is set:
  ```bash
  gh variable get PUBLIC_URL --env production
  az containerapp show -g "$(gh variable get AZURE_RESOURCE_GROUP --env production)" -n speakerdesk \
    --query properties.configuration.ingress.fqdn -o tsv
  ```

## `--signup` writes data

It creates `smoke+<timestamp>@example.invalid`. Use it freely locally. Against production, **ask the user first**; afterwards they can delete the account in Admin → Users.

## After a deploy

Check the deployed revision really contains the commit before you blame the code: `gh run list --limit 3` (is the run for this commit finished and green?). A check failing on production while it passes locally usually means the deploy is still running or failed.

## Reading failures

| Failing check | Usual cause | Where to look |
| --- | --- | --- |
| `/api/health` | Container not running / crash loop | `azure-ops` skill → logs and revisions |
| `/api/health?deep=1` | Database unreachable, schema missing, firewall rule `AllowAzureServices` gone | `azure-ops` skill |
| `get-session` 500 | `BETTER_AUTH_URL` empty or invalid (e.g. literal `""` from the `PUBLIC_URL` GitHub variable), or `BETTER_AUTH_SECRET` missing | container env: `az containerapp show … --query "properties.template.containers[0].env"` |
| No password field with `--expect-password` | `AUTH_EMAIL_PASSWORD` is not lowercase `true` | `infra/main.bicep` (`toLower(string(...))`) |
| "redirects off-site to https://0.0.0.0:3000" | A redirect built from `request.url` | Use `appUrl()` / `safeNextPath()` from `src/lib/app-url.ts` |
| Public page 307 | Page now requires a session or is a deliberate redirect | Decide which; update the lists in `scripts/smoke.mjs` if deliberate |

## Keeping it current

When you add a public page, a protected area, or a new post-login route, add it to the lists in `scripts/smoke.mjs` in the same change.

## Report

Paste the script output. For each failure, state the cause you confirmed (with the evidence: log line, env value, code location) — not a guess.
