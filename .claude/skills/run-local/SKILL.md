---
name: run-local
description: Start SpeakerDesk locally — PostgreSQL, migrations, dev server — and sign in as a test user (sign-in codes come from the email outbox). Use when asked to run, start or try the app locally, before smoke or security testing against localhost, or to reproduce a bug.
---

# Run SpeakerDesk locally

## 1. Database

`DATABASE_URL` in `.env` decides where it connects — read it first (don't print the password). `docker-compose.yml` publishes Postgres on **5432**; if `.env` uses another port, either change the URL or run the container on that port.

```bash
docker compose up -d          # or: podman machine start && podman compose up -d
```

If neither Docker nor Podman is running, ask the user how they run Postgres rather than starting a VM yourself.

## 2. Install, migrate, run

```bash
npm install                   # runs prisma generate
npm run db:deploy             # apply existing migrations (use db:migrate only when changing the schema)
npm run dev                   # http://localhost:3000 — run in the background
```

Wait until `curl -s localhost:3000/api/health?deep=1` returns `{"ok":true,"database":"up"}`.

`.env` needs `BETTER_AUTH_SECRET` (any 32+ byte random string) and `BETTER_AUTH_URL="http://localhost:3000"`. In development, email + password sign-in is on and mail is only written to the outbox.

## 3. Test accounts

- Sign up at `/sign-in` → "Create account", or via API:
  ```bash
  curl -s -c /tmp/sd-cookies -X POST localhost:3000/api/auth/sign-up/email \
    -H 'content-type: application/json' -H 'origin: http://localhost:3000' \
    -d '{"email":"a@example.test","password":"local-password-1","name":"Alice"}'
  ```
- **Codes** (passcode sign-in, verification, reset) are in the outbox table:
  ```bash
  npx prisma db execute --stdin <<< "select \"to\", subject, text from outbound_email order by \"createdAt\" desc limit 3;"
  ```
  or in the UI under Admin → Email outbox.
- **Admin:** add the email to `ADMIN_EMAILS` in `.env` *before* signing up (restart the dev server).
- Browse data: `npm run db:studio`.

## 4. Production-like run

To reproduce container-only issues (redirect origins, standalone output, env parsing):
```bash
npm run build && PORT=3000 HOSTNAME=0.0.0.0 NODE_ENV=production node .next/standalone/server.js
```
(copy `public/` and `.next/static/` next to the standalone server first, as the Dockerfile does).

## Stop

Stop the dev server process you started; `docker compose down` (add `-v` only if the user wants the data gone).
