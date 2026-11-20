---
name: db-migration
description: Change the SpeakerDesk database schema safely with Prisma 7 — edit prisma/schema.prisma, generate and review the migration SQL, and keep it backward compatible with the running app (migrations deploy before the new image). Use whenever a task needs a new model, column, index, enum value, rename or removal.
---

# Database migrations

Prisma 7 with `@prisma/adapter-pg`; config in `prisma.config.ts`; client generated into `src/generated/prisma`. Migrations live in `prisma/migrations/` and are applied in production by CI (`npm run db:deploy` = `prisma migrate deploy`) **before** the new image rolls out.

## The one rule: backward compatible

For a few minutes the **old** app runs against the **new** schema. Every migration must work with the code currently in production.

| Change | Safe way |
| --- | --- |
| Add a column | Nullable, or `NOT NULL` with a `@default` |
| Add a model / index / enum value | Safe. Large tables: consider `CREATE INDEX CONCURRENTLY` (edit the SQL; it can't run in a transaction) |
| Make a column required | Release 1: add + backfill + write it everywhere. Release 2: make it `NOT NULL` |
| Rename a column/table | Never in one step. Add new → dual-write + backfill → switch reads → drop old in a later release. Or keep the DB name with `@map` and only rename in Prisma |
| Drop a column/table | Release 1: stop reading/writing it. Release 2: drop |
| Change a type | New column + backfill, as with a rename |

Better Auth owns `user`, `session`, `account`, `verification` — check its docs before changing those, and run its schema expectations against your change.

## Steps

1. Need a local database (see `run-local`). Confirm `DATABASE_URL` in `.env` points to it — **never** run `migrate dev` against production.
2. Edit `prisma/schema.prisma`. Follow existing conventions: `cuid()` ids, `@@map("snake_case")` table names, `createdAt`/`updatedAt`, indexes for every foreign key you filter on, `onDelete` chosen deliberately.
3. Generate: `npx prisma migrate dev --name <snake_case_description>`
4. **Read the generated `migration.sql`.** Look for `DROP`, `ALTER COLUMN … SET NOT NULL`, `ALTER TYPE`, table rewrites, and data loss warnings. Add backfill `UPDATE`s by hand where needed.
5. Update code that uses the model (queries in `src/lib/*-queries.ts`, actions in `src/lib/actions/`, Zod schemas in `src/lib/validation.ts`). Keep tenant scoping (`userId` / `requireEventAccess`).
6. Run the `verify` skill.
7. Optionally prove it on a fresh DB: `npx prisma migrate reset` (local only — it wipes data; ask if the local DB has data the user cares about).

## Never

- Edit or delete a migration that's already on `main` — production has applied it. Write a new one.
- Use `prisma db push` for real changes (no migration file → production never gets it).
- Put secrets or production data in migrations.

## Report

Show the migration SQL, say whether it's backward compatible and why, and list any follow-up release needed (e.g. "drop `oldColumn` after this is deployed").
