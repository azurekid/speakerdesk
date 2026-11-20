---
name: upgrade-deps
description: Keep SpeakerDesk's dependencies current and secure — triage npm audit/outdated, upgrade in safe batches (Next.js, React, Prisma, Better Auth, Tailwind, Azure SDKs, Node base image, GitHub Actions), read breaking-change notes, and verify. Use for routine maintenance, security advisories, or when asked to update/upgrade packages.
---

# Upgrade dependencies

## 1. Survey

```bash
npm audit --omit=dev
npm outdated
```

Also check outside `package.json`:
- `Dockerfile` base image (`node:24-alpine`) and `deploy.yml` `node-version`
- GitHub Actions versions in `.github/workflows/deploy.yml` (`actions/checkout`, `actions/setup-node`, `azure/login`)
- Bicep resource API versions in `infra/main.bicep` (`az bicep lint --file infra/main.bicep` warns on old ones)

## 2. Batch by risk

Upgrade one batch at a time, run the `verify` skill after each, and stop on failure.

1. **Security fixes** (from `npm audit`) — first, smallest possible bump.
2. **Patch/minor** of low-risk packages (`lucide-react`, `zod` minor, `papaparse`, `@types/*`).
3. **Framework, one at a time, with its changelog read first:**
   - **Next.js** + `eslint-config-next` (keep them on the same version) — read `node_modules/next/dist/docs/` and the upgrade guide under `01-app/02-guides/upgrading/` after installing. Watch `next.config.ts` options (`cacheComponents`, `partialPrefetching`), `proxy.ts`, and generated route types.
   - **React** + `react-dom` + `@types/react*` together.
   - **Prisma** (`prisma`, `@prisma/client`, `@prisma/adapter-pg` — same version). Rerun `npx prisma generate`; check `prisma.config.ts` and CLI flag changes. Never let an upgrade create a migration you didn't intend.
   - **Better Auth** — check plugin APIs (`admin`, `emailOTP`), cookie/session changes and whether its schema changed (needs a migration via `db-migration`).
   - **Tailwind** (`tailwindcss` + `@tailwindcss/turbopack` same version).
4. **Node major** — Dockerfile, `deploy.yml`, `@types/node` together.

Use exact `npm install pkg@version`; commit `package-lock.json` with `package.json`.

## 3. Verify

- `verify` skill (typecheck, lint, build).
- `run-local` + `smoke-test --signup` locally — sign-in, onboarding and a page per area (speaker, organizer, sponsor, admin).
- For Next/Better Auth upgrades also run the `pentest` automated probe locally (headers, redirects, auth origin check).

## Report

Table of package → from → to, with notable breaking changes and what you changed for them. List anything you deliberately held back and why.
