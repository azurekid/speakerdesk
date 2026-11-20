---
name: azure-ops
description: Operate SpeakerDesk in production on Azure — watch and debug the GitHub Actions deploy, read Container App logs, inspect env/secrets/revisions, roll back, change config, and diagnose Bicep/ARM deployment failures. Use when a deploy fails, the production site misbehaves, or the user asks to deploy, roll back, change a production setting, or check logs.
---

# Operating SpeakerDesk on Azure

Full setup guide: `docs/deploy-azure.md`. Infrastructure: `infra/main.bicep` + `infra/main.bicepparam`. Pipeline: `.github/workflows/deploy.yml`.

## How a deploy works

Every push to `main` (or a manual run) does: check (typecheck, lint) → create resource group → Bicep phase 1 (everything except the app) → `az acr build` → open Postgres firewall for the runner (via `az rest`) → `prisma migrate deploy` → close firewall → Bicep phase 2 (app with the new image) → smoke test on `/api/health?deep=1`.

**Pushing to `main` deploys to production.** Commit/push only when the user asks.

## Context you'll need

```bash
RG=$(gh variable get AZURE_RESOURCE_GROUP --env production)
gh variable list --env production          # AZURE_LOCATION, ADMIN_EMAILS, PUBLIC_URL, …
gh secret list --env production            # names only
```

Resource names come from Bicep outputs (`az deployment group list -g "$RG" -o table`, then `az deployment group show -g "$RG" -n <name> --query properties.outputs`). The app is `speakerdesk`.

## Watch / debug the pipeline

```bash
gh run list --limit 5
gh run watch <id> --exit-status
gh run view <id> --log-failed               # only the failing step's log
gh run rerun <id> --failed
```

For ARM errors, get the real cause:
```bash
az deployment operation group list -g "$RG" -n <deployment> \
  --query "[?properties.provisioningState=='Failed'].properties.statusMessage" -o json
```

## Inspect the running app

```bash
az containerapp show -g "$RG" -n speakerdesk --query "properties.template.containers[0].env" -o json
az containerapp revision list -g "$RG" -n speakerdesk -o table
az containerapp logs show -g "$RG" -n speakerdesk --tail 100 --format text
az containerapp logs show -g "$RG" -n speakerdesk --type system --tail 50   # pulls, probes, crashes
```

Then run the `smoke-test` skill against the URL.

## Change configuration

Prefer changing the **source** (GitHub variable/secret or Bicep) and redeploying — every pipeline run re-applies Bicep, so `az containerapp update --set-env-vars` changes are **overwritten on the next deploy**. Use direct updates only as a stop-gap, and tell the user.

- Plain values: `gh variable set NAME --env production --body "value"` (never `--body '""'` — an empty-looking value becomes a literal `""`; use `gh variable delete` to unset).
- Secrets: `gh secret set NAME --env production`.
- Changing `SPEAKERDESK_AUTH_SECRET` signs everyone out. Changing `SPEAKERDESK_PG_PASSWORD` changes the database admin password on the next deploy.

## Roll back

```bash
ACR=$(az acr list -g "$RG" --query "[0].loginServer" -o tsv)
az containerapp update -g "$RG" -n speakerdesk --image "$ACR/speakerdesk:<previous-sha>"
```

This lasts until the next push. For a lasting rollback, `git revert` the bad commit and push (ask first). Database migrations are **not** rolled back — they must be backward compatible (see `db-migration` skill).

## Known failure modes (seen in this project)

| Symptom | Cause | Fix |
| --- | --- | --- |
| `ParameterOutOfRange: The value of the 'Version' should be in: []` on Postgres | Subscription restricted from Postgres in that region | `az postgres flexible-server list-skus -l <region>` — `reason` says "restricted". Use another region (new RG; a RG can't move) |
| `az postgres flexible-server firewall-rule` argument errors | CLI changed `--name`/`--server-name`/`--rule-name` between versions; runner CLI ≠ local CLI | The workflow uses `az rest` on the ARM API — keep it that way |
| Step output silently empty | GitHub drops step outputs containing a secret value | Don't put secrets (incl. subscription ID) in outputs; rebuild in the consuming step |
| `BetterAuthError: Invalid base URL: ""` | `BETTER_AUTH_URL` empty/garbage (e.g. `PUBLIC_URL` variable stored as `""`) | Fix the variable; Bicep falls back to the default URL only for values not starting with `http` |
| Password option missing on sign-in | Bicep `string(true)` = `"True"` | `toLower()` in Bicep; app compares case-insensitively |
| Redirect to `https://0.0.0.0:3000/...` | Redirect built from `request.url` (`HOSTNAME=0.0.0.0` in the image) | Use `appUrl()` / `safeNextPath()` |
| Migration step timeout | Firewall rule not yet applied, or policy blocks public access | Re-run; workflow waits 30 s after creating the rule |
| Image pull `UNAUTHORIZED` | `AcrPull` role assignment not propagated | Wait a few minutes, re-run |
| `No matching federated identity record` | OIDC subject mismatch | Must be `repo:<owner>/<repo>:environment:production` |

When you hit a new one, add a row here.

## Report

State what you looked at (commands), what you found (log lines, values — redact secrets), the confirmed cause, and what you changed. Say plainly if a deploy or fix hasn't been verified yet.
