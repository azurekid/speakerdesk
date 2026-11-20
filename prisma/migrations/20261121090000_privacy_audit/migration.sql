-- Privacy clean-up + full audit log.

-- ── Terms versioning ─────────────────────────────────────────────────────────
ALTER TABLE "user" ADD COLUMN "termsVersion" TEXT;

-- ── Remove personal data we don't need ───────────────────────────────────────
-- Phone, dietary restrictions and accessibility needs are no longer collected.
-- The data is erased now. The columns stay until the next release, because the
-- previous app version still selects them while this deploy rolls out.
-- FOLLOW-UP (next release): ALTER TABLE "speaker_profile" DROP COLUMN "phone",
--   DROP COLUMN "dietaryRestrictions", DROP COLUMN "accessibilityNeeds";
UPDATE "speaker_profile" SET "phone" = '', "dietaryRestrictions" = '', "accessibilityNeeds" = ''
WHERE "phone" <> '' OR "dietaryRestrictions" <> '' OR "accessibilityNeeds" <> '';

-- Disability-related presentation requirements were removed from the catalog.
UPDATE "proposal" SET "requirements" = array_remove(array_remove("requirements", 'step_free'), 'stage_seat')
WHERE "requirements" && ARRAY['step_free', 'stage_seat']::text[];

-- ── Audit log: from admin-only to full audit trail ───────────────────────────
ALTER TABLE "admin_audit_log" ADD COLUMN "actorEmail" TEXT NOT NULL DEFAULT '',
ADD COLUMN "category" TEXT NOT NULL DEFAULT 'admin',
ADD COLUMN "impersonatorId" TEXT,
ADD COLUMN "ipAddress" TEXT NOT NULL DEFAULT '',
ADD COLUMN "metadata" JSONB,
ADD COLUMN "outcome" TEXT NOT NULL DEFAULT 'success',
ADD COLUMN "userAgent" TEXT NOT NULL DEFAULT '';

UPDATE "admin_audit_log" a SET "actorEmail" = u."email" FROM "user" u WHERE a."actorId" = u."id";

CREATE INDEX "admin_audit_log_actorId_createdAt_idx" ON "admin_audit_log"("actorId", "createdAt");
CREATE INDEX "admin_audit_log_category_createdAt_idx" ON "admin_audit_log"("category", "createdAt");
