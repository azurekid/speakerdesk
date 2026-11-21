# Deploying SpeakerDesk to Azure

This guide takes SpeakerDesk from an empty Azure subscription to a running production site with continuous deployment. A first deployment takes about an hour; most of that is waiting for Azure to provision.

Everything in this guide comes from three files in the repo:

| File | What it does |
| --- | --- |
| [`infra/main.bicep`](../infra/main.bicep) | Every Azure resource SpeakerDesk needs, in one resource group |
| [`infra/main.bicepparam`](../infra/main.bicepparam) | Parameters. Secrets are read from environment variables, so they never land in git |
| [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml) | CI/CD on every push to `main`: check → provision infrastructure → build image → migrate database → roll out → smoke test |

---

## 1. Architecture

```mermaid
flowchart LR
  user([Browser]) -->|HTTPS| app

  subgraph rg[Resource group]
    app[Container App<br/>Next.js, port 3000]
    acr[(Container Registry)]
    pg[(PostgreSQL<br/>Flexible Server)]
    blob[(Blob Storage<br/>headshots)]
    maps[Azure Maps]
    acs[Communication Services<br/>Email]
    logs[Log Analytics]
  end

  gh[GitHub Actions] -->|az acr build| acr
  gh -->|prisma migrate deploy| pg
  gh -->|az containerapp update| app
  acr -->|pull with managed identity| app
  app --> pg
  app --> blob
  app -->|venue search| maps
  app -->|passcodes, resets| acs
  app --> logs
  user -->|headshot URLs| blob
```

| Resource | SKU in the template | Used for |
| --- | --- | --- |
| Container Apps environment + app | Consumption, 0.5 vCPU / 1 GiB, 1–5 replicas | The web app (Docker image built from the repo's `Dockerfile`) |
| Container Registry | Basic | Images. The app pulls with a **managed identity**, so there's no registry password |
| PostgreSQL Flexible Server | Burstable B1ms, v16, 32 GB, 14-day backups | All data |
| Storage account | Standard LRS, `headshots` container with public blob read | Speaker headshots. Their URLs are pasted into CfPs, so they must be public |
| Azure Maps | Gen2 | Venue search in the event form |
| Communication Services + Email | Azure-managed sender domain | Sign-in codes, email verification, password resets, email changes |
| Log Analytics | Pay-as-you-go, 90-day retention | Container logs, including one structured `audit` line per audited action |

These are the smallest sensible production tiers. Check current prices for your region in the [Azure pricing calculator](https://azure.microsoft.com/pricing/calculator/).

---

## 2. Prerequisites

- An Azure subscription where you can create resource groups and role assignments (**Owner**, or **Contributor** + **User Access Administrator**).
- [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli) 2.60 or newer, signed in with `az login`.
- Node.js 22 or newer, plus this repository cloned locally. Locally you only need these for the first database migration.
- Optional: [GitHub CLI](https://cli.github.com/) (`gh`) for setting up CI secrets.

You do **not** need Docker. Images are built in the cloud with `az acr build`.

Register the resource providers once per subscription:

```bash
for ns in Microsoft.App Microsoft.ContainerRegistry Microsoft.DBforPostgreSQL Microsoft.Storage \
          Microsoft.Maps Microsoft.Communication Microsoft.OperationalInsights Microsoft.ManagedIdentity; do
  az provider register --namespace "$ns" --wait
done
```

---

## 3. First deployment

The first deployment has two phases, because the container app can only start once an image exists and the database schema is in place:

1. **Phase 1:** create the infrastructure without the app.
2. **Build** the image and **migrate** the database.
3. **Phase 2:** deploy the app.

### 3.1 Choose names and secrets

```bash
export RG=speakerdesk-prod
export LOCATION=westeurope

# Secrets — keep these somewhere safe (e.g. your password manager). They're read by infra/main.bicepparam.
export SPEAKERDESK_PG_PASSWORD="$(openssl rand -base64 24 | tr -d '/+=')Aa1"
export SPEAKERDESK_AUTH_SECRET="$(openssl rand -base64 32)"

# Who becomes platform admin on sign-up (comma-separated).
export SPEAKERDESK_ADMIN_EMAILS="you@example.com"

az group create --name "$RG" --location "$LOCATION"
```

> **Don't rotate `SPEAKERDESK_AUTH_SECRET` casually.** Changing it signs everyone out and invalidates outstanding codes.

### 3.2 Phase 1: infrastructure

```bash
SPEAKERDESK_DEPLOY_APP=false \
az deployment group create \
  --resource-group "$RG" \
  --template-file infra/main.bicep \
  --parameters infra/main.bicepparam \
  --name infra-phase1
```

Save the outputs. You'll need them in the next steps:

```bash
out() { az deployment group show -g "$RG" -n infra-phase1 --query "properties.outputs.$1.value" -o tsv; }
export ACR_NAME=$(out registryName)
export ACR_SERVER=$(out registryLoginServer)
export PG_SERVER=$(out postgresServerName)
export PG_HOST=$(out postgresHost)
echo "$ACR_SERVER  $PG_HOST"
```

### 3.3 Build the image

This builds the repository's `Dockerfile` inside Azure Container Registry:

```bash
export TAG=$(git rev-parse --short HEAD)
az acr build --registry "$ACR_NAME" --image "speakerdesk:$TAG" --image speakerdesk:latest .
```

### 3.4 Create the database schema

Open the PostgreSQL firewall for your own IP address temporarily, run the migrations, then close it again:

```bash
MY_IP=$(curl -fsS https://api.ipify.org)
az postgres flexible-server firewall-rule create -g "$RG" -n "$PG_SERVER" \
  --rule-name my-laptop --start-ip-address "$MY_IP" --end-ip-address "$MY_IP" -o none

export DATABASE_URL="postgresql://speakerdesk:$(node -p 'encodeURIComponent(process.env.SPEAKERDESK_PG_PASSWORD)')@$PG_HOST:5432/speakerdesk?sslmode=require"
npm ci
npm run db:deploy        # prisma migrate deploy — applies everything in prisma/migrations

az postgres flexible-server firewall-rule delete -g "$RG" -n "$PG_SERVER" --rule-name my-laptop --yes -o none
```

### 3.5 Phase 2: deploy the app

```bash
SPEAKERDESK_DEPLOY_APP=true SPEAKERDESK_IMAGE="$ACR_SERVER/speakerdesk:$TAG" \
az deployment group create \
  --resource-group "$RG" \
  --template-file infra/main.bicep \
  --parameters infra/main.bicepparam \
  --name infra-phase2

az deployment group show -g "$RG" -n infra-phase2 --query properties.outputs.appUrl.value -o tsv
```

Open that URL. You should see the SpeakerDesk landing page. To check the app's health directly:

```bash
APP_URL=$(az deployment group show -g "$RG" -n infra-phase2 --query properties.outputs.appUrl.value -o tsv)
curl "$APP_URL/api/health?deep=1"     # {"ok":true,"database":"up"}
```

### 3.6 Create the first admin

Sign up on the site with an address listed in `SPEAKERDESK_ADMIN_EMAILS`. That account gets the platform admin role automatically. A shield-shaped **Admin** link then appears at the bottom of the sidebar, and **Admin → Overview** should show no "mail service" warning.

---

## 4. Custom domain

Production runs on **https://speakerdesk.eu** (registered at GoDaddy, DNS at GoDaddy). Container Apps issues and renews a free managed certificate.

1. **DNS at the registrar.** Get the values with
   `az containerapp env show -g "$RG" -n speakerdesk-env --query "properties.{ip:staticIp, verify:customDomainConfiguration.customDomainVerificationId}"`, then create:

   | Type | Name | Value |
   | --- | --- | --- |
   | `A` | `@` | the environment's static IP |
   | `TXT` | `asuid` | the verification ID |
   | `CNAME` | `www` | `speakerdesk.eu` (or the app's default hostname) |
   | `TXT` | `asuid.www` | the verification ID (only if you bind `www` too) |

   Remove any parking or forwarding records the registrar added for `@`.

2. **Add the hostname and request the certificate** (one time per domain):

   ```bash
   az containerapp hostname add -g "$RG" -n speakerdesk --hostname speakerdesk.eu
   az containerapp env certificate create -g "$RG" -n speakerdesk-env \
     --hostname speakerdesk.eu --validation-method HTTP     # apex: HTTP; subdomains: CNAME
   az containerapp env certificate list -g "$RG" -n speakerdesk-env -o table   # wait for Succeeded
   ```

3. **Tell the pipeline.** Every deploy re-applies `infra/main.bicep`, which binds exactly the domains in `CUSTOM_DOMAINS` (anything else is removed), and `PUBLIC_URL` becomes `BETTER_AUTH_URL`:

   ```bash
   gh variable set CUSTOM_DOMAINS --env production --body '[{"name":"speakerdesk.eu","certificateName":"<name from the list above>"}]'
   gh variable set PUBLIC_URL     --env production --body "https://speakerdesk.eu"
   ```

   Then push or re-run the workflow. To bind immediately without a deploy:
   `az containerapp hostname bind -g "$RG" -n speakerdesk --hostname speakerdesk.eu --environment speakerdesk-env --certificate <name>`.

4. **Canonical host.** `src/lib/site.ts` (`SITE_URL`) is the address search engines index. `www.` and the `*.azurecontainerapps.io` address redirect there with a 301 (`src/proxy.ts`).

5. Update the callback URLs of any OAuth apps (section 6).

6. **Search engines.** Verify the domain in Google Search Console and Bing Webmaster Tools (a DNS `TXT` record at the registrar is easiest) and submit `https://speakerdesk.eu/sitemap.xml`.

---

## 5. Continuous deployment (GitHub Actions)

On every push to `main` the workflow does the following:

1. Typechecks and lints.
2. Creates the resource group (if missing) and deploys `infra/main.bicep` without the container app (phase 1). This is idempotent: it creates missing resources and updates changed ones.
3. Builds the image in ACR, tagged with the commit SHA.
4. Opens the database firewall for the runner's IP only, runs `prisma migrate deploy`, and closes the firewall again.
5. Deploys `infra/main.bicep` again with the new image (phase 2), which rolls out the app.
6. Polls `/api/health?deep=1` until the new revision is healthy.

So **a brand-new subscription needs no manual first deployment**: set up the identity and settings below, push, and the pipeline provisions everything. Sections 3.1 to 3.5 are only needed if you'd rather bootstrap by hand.

It signs in to Azure with **OpenID Connect**, so no Azure password or key is stored in GitHub.

### 5.1 Create the deployment identity

Because the pipeline creates the resource group and the Bicep template assigns the `AcrPull` role, the identity needs rights on the **subscription**: **Contributor** plus **User Access Administrator** (or **Owner**).

```bash
export GH_REPO=your-org/speakerdesk           # owner/name on GitHub
APP_ID=$(az ad app create --display-name "speakerdesk-github-deploy" --query appId -o tsv)
az ad sp create --id "$APP_ID" -o none

# Trust GitHub's tokens for jobs that use the "production" environment of this repo.
az ad app federated-credential create --id "$APP_ID" --parameters "{
  \"name\": \"github-production\",
  \"issuer\": \"https://token.actions.githubusercontent.com\",
  \"subject\": \"repo:$GH_REPO:environment:production\",
  \"audiences\": [\"api://AzureADTokenExchange\"]
}"

SUB_ID=$(az account show --query id -o tsv)
for role in Contributor "User Access Administrator"; do
  az role assignment create --assignee "$APP_ID" --role "$role" --scope "/subscriptions/$SUB_ID"
done
```

Register the resource providers once (section 2) as well. The pipeline doesn't do that.

### 5.2 Add secrets and variables to GitHub

Create a **`production`** environment in the repository settings (*Settings → Environments*). If you want a manual approval before each deploy, add required reviewers there. Then set:

```bash
gh secret set AZURE_CLIENT_ID       --env production --body "$APP_ID"
gh secret set AZURE_TENANT_ID       --env production --body "$(az account show --query tenantId -o tsv)"
gh secret set AZURE_SUBSCRIPTION_ID --env production --body "$SUB_ID"

# Read by infra/main.bicepparam. Generate once and keep them: rotating the auth secret signs everyone out.
gh secret set SPEAKERDESK_PG_PASSWORD  --env production --body "$(openssl rand -base64 24 | tr -d '/+=')Aa1"
gh secret set SPEAKERDESK_AUTH_SECRET  --env production --body "$(openssl rand -base64 32)"

gh variable set AZURE_RESOURCE_GROUP --env production --body speakerdesk-prod
gh variable set AZURE_LOCATION       --env production --body westeurope
gh variable set ADMIN_EMAILS         --env production --body "you@example.com"
# Optional: only set PUBLIC_URL once you have a custom domain, e.g. https://speakerdesk.example.com (section 4). Leave it unset otherwise.
# gh variable set PUBLIC_URL --env production --body "https://speakerdesk.example.com"
```

Optional sign-in providers (section 6): set `OAUTH_<PROVIDER>_CLIENT_ID` and `OAUTH_<PROVIDER>_CLIENT_SECRET` as environment secrets, for `GITHUB`, `GOOGLE`, `LINKEDIN` and `MICROSOFT`.

Push to `main` (or run the workflow manually from the *Actions* tab) to deploy. Resource names (registry, database server) are derived from the resource group, so the workflow reads them from the Bicep outputs. You don't configure them.

> **Keep `PUBLIC_URL` set once you use a custom domain.** Every pipeline run redeploys the template, and an empty value falls back to the default `*.azurecontainerapps.io` URL, which breaks sign-in.

> **Migrations must be backward compatible.** They run *before* the new image rolls out, so the old revision briefly runs against the new schema. Add columns as nullable or with defaults. To rename or drop a column, release in two steps: first stop using it, then remove it.

---

## 6. Sign-in providers (optional)

Passcode sign-in (a 6-digit code by email) always works. Email + password is on by default; add `param allowEmailPassword = false` to `main.bicepparam` to turn it off. Social providers turn on as soon as both their client id and secret are set.

| Provider | Where to register | Callback URL |
| --- | --- | --- |
| GitHub | GitHub → Settings → Developer settings → OAuth Apps | `https://<domain>/api/auth/callback/github` |
| Google | Google Cloud Console → APIs & Services → Credentials | `https://<domain>/api/auth/callback/google` |
| LinkedIn | LinkedIn Developers (product: *Sign In with LinkedIn using OpenID Connect*) | `https://<domain>/api/auth/callback/linkedin` |
| Microsoft | Microsoft Entra ID → App registrations, account type *any org directory + personal accounts* | `https://<domain>/api/auth/callback/microsoft` |

Export the credentials and redeploy:

```bash
export SPEAKERDESK_GITHUB_CLIENT_ID=… SPEAKERDESK_GITHUB_CLIENT_SECRET=…   # likewise SPEAKERDESK_GOOGLE_*, _LINKEDIN_*, _MICROSOFT_*
SPEAKERDESK_IMAGE="$ACR_SERVER/speakerdesk:$TAG" SPEAKERDESK_PUBLIC_URL="https://$DOMAIN" \
az deployment group create -g "$RG" -f infra/main.bicep -p infra/main.bicepparam -n providers
```

---

## 7. Email

The template provisions Azure Communication Services with an **Azure-managed sender domain** (`DoNotReply@<random>.azurecomm.net`) and wires up `AZURE_COMMUNICATION_CONNECTION_STRING` and `EMAIL_FROM` automatically. Codes start working straight away.

For production, switch to **your own domain**:

- Azure-managed domains have low sending limits.
- Mail from your own domain is more likely to reach the inbox.

To switch:

1. In the portal, open the Email Communication Service (`speakerdesk-email`) and choose **Provision domains → Custom domain**. Add the `TXT`, SPF and DKIM records it shows to your DNS and wait for verification.
2. Under **Communication Services → Email → Domains**, connect the verified domain.
3. Change the `EMAIL_FROM` value in `main.bicep` (or override it with `az containerapp update --set-env-vars EMAIL_FROM=noreply@example.com`).

Every message, delivered or not, is recorded in **Admin → Email outbox**. Codes are redacted there once they've been delivered.

---

## 8. Configuration reference

The Bicep template sets all of these. Use this table when you change something by hand, or when you run the image elsewhere.

| Variable | Required | Set by template | Notes |
| --- | --- | --- | --- |
| `DATABASE_URL` | yes | ✓ (secret) | `postgresql://user:pass@host:5432/speakerdesk?sslmode=require`. URL-encode the password |
| `BETTER_AUTH_SECRET` | yes | ✓ (secret) | 32+ random bytes. Rotating it signs everyone out |
| `BETTER_AUTH_URL` | yes | ✓ | Public URL of the site. **Must match the browser's origin exactly**, or sign-in fails |
| `AUTH_EMAIL_PASSWORD` | no | ✓ | `true`/`false`. Email + password sign-in (passcodes are always on) |
| `ADMIN_EMAILS` | no | ✓ | Comma-separated. These addresses become platform admins when they sign up |
| `AZURE_STORAGE_CONNECTION_STRING` | yes in prod | ✓ (secret) | Headshot uploads. Without it, uploads fail in production |
| `AZURE_STORAGE_CONTAINER` | no | ✓ | Default `headshots` |
| `AZURE_STORAGE_PUBLIC_BASE_URL` | no | — | Set when a CDN / Front Door serves the container |
| `AZURE_MAPS_KEY` | no | ✓ (secret) | Venue search. Without it the app falls back to the public Photon service, which isn't suitable for production |
| `AZURE_COMMUNICATION_CONNECTION_STRING` | yes in prod | ✓ (secret) | Without it, codes are only recorded in the outbox and nobody receives them |
| `EMAIL_FROM` | yes in prod | ✓ | A verified ACS sender address |
| `GITHUB_CLIENT_ID` / `_SECRET` (and `GOOGLE_*`, `LINKEDIN_*`, `MICROSOFT_*`) | no | when provided | `MICROSOFT_TENANT_ID` defaults to `common` |

### Where each kind of value is set

| Where | What goes there | How |
| --- | --- | --- |
| **Your shell** (`export …`) | Inputs to `infra/main.bicepparam`: `SPEAKERDESK_PG_PASSWORD`, `SPEAKERDESK_AUTH_SECRET`, `SPEAKERDESK_ADMIN_EMAILS`, `SPEAKERDESK_PUBLIC_URL`, `SPEAKERDESK_IMAGE`, `SPEAKERDESK_GITHUB_CLIENT_ID`… | `export NAME=value`, then run `az deployment group create`. The param file reads them with `readEnvironmentVariable()`; Bicep turns them into the container app's environment variables and secrets |
| **GitHub** (*Settings → Environments → production*) | CI credentials plus the same inputs as the row above (`SPEAKERDESK_PG_PASSWORD`, `SPEAKERDESK_AUTH_SECRET`, `ADMIN_EMAILS`, `PUBLIC_URL`, `OAUTH_*`) | `gh secret set NAME --env production`, `gh variable set NAME` (section 5.2) |
| **The running container app** | Any variable from the table below, changed in place | `az containerapp update --set-env-vars` (plain values) or `az containerapp secret set` + `--set-env-vars NAME=secretref:secret-name` (secrets) |
| **Local development** | Everything, with dev defaults | Copy `.env.example` to `.env` |

Note that `SPEAKERDESK_*` names exist only for the Bicep param file; the app itself reads the names in the table below (`ADMIN_EMAILS`, `BETTER_AUTH_URL`, …).

To change a single value without a full redeploy:

```bash
az containerapp update -g "$RG" -n speakerdesk --set-env-vars ADMIN_EMAILS="a@example.com,b@example.com"
# secrets: az containerapp secret set …, then restart the revision
```

> **Redeploying Bicep later?** Always pass the image that's currently running (`SPEAKERDESK_IMAGE`) and your `SPEAKERDESK_PUBLIC_URL`. Otherwise the template falls back to their defaults (no image, and the default `*.azurecontainerapps.io` URL).

---

## 9. Operating SpeakerDesk

| Task | How |
| --- | --- |
| **Live logs** | `az containerapp logs show -g "$RG" -n speakerdesk --follow` |
| **Query logs** | Log Analytics `speakerdesk-logs` → `ContainerAppConsoleLogs_CL \| where ContainerAppName_s == "speakerdesk"` |
| **Health** | `GET /api/health` (liveness) and `GET /api/health?deep=1` (database). Both are wired up as Container Apps probes |
| **Roll back** | `az containerapp update -g "$RG" -n speakerdesk --image "$ACR_SERVER/speakerdesk:<previous-sha>"`. Old images stay in ACR |
| **Scale** | `minReplicas` / `maxReplicas` in `main.bicep`, or `az containerapp update --min-replicas 2 --max-replicas 10`. It scales on 50 concurrent requests per replica |
| **Database backups** | Automatic, 14 days, point-in-time restore: `az postgres flexible-server restore -g "$RG" --name speakerdesk-restore --source-server "$PG_SERVER" --restore-time "2027-01-31T13:00:00Z"` |
| **Bigger database** | `az postgres flexible-server update -g "$RG" -n "$PG_SERVER" --tier GeneralPurpose --sku-name Standard_D2ds_v5` |
| **User support** | **Admin → Users**: reset codes, temporary passwords, bans, "View as". Every admin action lands in **Admin → Audit log** |

The app keeps no state on the container's disk (uploads go to Blob Storage), so any number of replicas can run side by side.

---

## 10. Production hardening checklist

The template optimises for a straightforward, working setup. Before a public launch, consider:

- [ ] **Custom email domain** (section 7) with SPF, DKIM and DMARC.
- [ ] **Key Vault references** for Container App secrets instead of inline secret values, so rotation happens in one place.
- [ ] **Private networking:** a VNet-integrated Container Apps environment, PostgreSQL with private access (no public endpoint), and a private endpoint for Storage. CI migrations then need a self-hosted runner or a Container Apps Job in the VNet instead of the temporary firewall rule.
- [ ] **Azure Front Door + WAF** in front of the app, with rate limiting on `/api/auth/*` and the importers.
- [ ] **PostgreSQL high availability** (zone-redundant) and geo-redundant backups, if your SLA needs them.
- [ ] **Microsoft Entra authentication for PostgreSQL** instead of the admin password.
- [ ] **Alerts:** a failed readiness probe, 5xx rate, database CPU and storage, and `FAILED` messages in the email outbox.
- [ ] **Turn off email + password** (`param allowEmailPassword = false`) if you only want passcodes and social sign-in.

---

## 11. Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Sign-in fails with **"Invalid origin"** (403) in the logs | `BETTER_AUTH_URL` doesn't match the URL in the browser | Set it to the exact public URL, including `https://` and with no trailing slash (section 4.3) |
| Revision stuck **"Activating"** / readiness failing | Database unreachable or schema missing | Check `curl …/api/health?deep=1`, run the migrations (3.4), and check that the `AllowAzureServices` firewall rule exists |
| `az deployment` waits a long time on the container app | First deployment with no image | Use the two-phase flow (`SPEAKERDESK_DEPLOY_APP=false` first) |
| Image pull errors (`UNAUTHORIZED`) | The managed identity's `AcrPull` role hasn't propagated yet | Wait a few minutes, then `az containerapp update … --image …` again |
| Headshot upload fails ("Upload failed") and the logs say **"Blob storage is not configured"** | `AZURE_STORAGE_CONNECTION_STRING` missing | Redeploy with the template, or set the secret |
| Headshot URLs return **409 / PublicAccessNotPermitted** | Public blob access is disabled on the account (sometimes by policy) | Allow blob public access on the storage account, or serve through Front Door and set `AZURE_STORAGE_PUBLIC_BASE_URL` |
| Nobody receives sign-in codes | Mail not configured or delivery failing | Check **Admin → Overview** (mail warning) and **Admin → Email outbox** (status `FAILED` plus the error) |
| CI fails at **"Run database migrations"** with a timeout | Firewall rule not applied yet, or a policy blocks public access | Re-run the job; for private-only databases see the hardening checklist |
| CI login fails: **"No matching federated identity record"** | The federated credential's subject doesn't match | It must be `repo:<owner>/<repo>:environment:production`, and the job must use `environment: production` |

---

## Tearing it down

```bash
az group delete --name "$RG" --yes --no-wait
```

This deletes everything, including the database and its backups.
