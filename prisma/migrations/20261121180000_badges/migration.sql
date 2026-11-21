-- Badges: platform badges every event can use, event-specific badges, and awards that recipients accept.

-- CreateEnum
CREATE TYPE "BadgeStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'REVOKED');

-- CreateTable
CREATE TABLE "badge" (
    "id" TEXT NOT NULL,
    "key" TEXT,
    "eventId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "icon" TEXT NOT NULL DEFAULT 'award',
    "color" TEXT NOT NULL DEFAULT 'brand',
    "createdById" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "badge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "badge_award" (
    "id" TEXT NOT NULL,
    "badgeId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "awardedById" TEXT,
    "message" TEXT NOT NULL DEFAULT '',
    "status" "BadgeStatus" NOT NULL DEFAULT 'PENDING',
    "showOnProfile" BOOLEAN NOT NULL DEFAULT true,
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "badge_award_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "badge_key_key" ON "badge"("key");

-- CreateIndex
CREATE INDEX "badge_eventId_idx" ON "badge"("eventId");

-- CreateIndex
CREATE INDEX "badge_award_recipientId_status_idx" ON "badge_award"("recipientId", "status");

-- CreateIndex
CREATE INDEX "badge_award_eventId_idx" ON "badge_award"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "badge_award_badgeId_eventId_recipientId_key" ON "badge_award"("badgeId", "eventId", "recipientId");

-- AddForeignKey
ALTER TABLE "badge" ADD CONSTRAINT "badge_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "badge" ADD CONSTRAINT "badge_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "badge_award" ADD CONSTRAINT "badge_award_badgeId_fkey" FOREIGN KEY ("badgeId") REFERENCES "badge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "badge_award" ADD CONSTRAINT "badge_award_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "badge_award" ADD CONSTRAINT "badge_award_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "badge_award" ADD CONSTRAINT "badge_award_awardedById_fkey" FOREIGN KEY ("awardedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Platform badges (stable keys; names and descriptions can be edited later).
INSERT INTO "badge" ("id", "key", "name", "description", "icon", "color", "updatedAt") VALUES
  ('badge_speaker',    'speaker',    'Speaker',            'Spoke at the event.',                                  'mic',        'brand',   now()),
  ('badge_keynote',    'keynote',    'Keynote speaker',    'Delivered a keynote.',                                 'crown',      'amber',   now()),
  ('badge_workshop',   'workshop',   'Workshop host',      'Ran a hands-on workshop.',                             'wrench',     'sky',     now()),
  ('badge_first_talk', 'first-talk', 'First-time speaker', 'Gave their first conference talk. Welcome to the stage!', 'sparkles', 'emerald', now()),
  ('badge_panelist',   'panelist',   'Panelist',           'Shared the stage on a panel.',                         'users',      'violet',  now()),
  ('badge_top_rated',  'top-rated',  'Top-rated session',  'One of the highest-rated sessions of the event.',       'star',       'amber',   now()),
  ('badge_mc',         'mc',         'Host / MC',          'Hosted a stage or the whole event.',                   'megaphone',  'violet',  now()),
  ('badge_volunteer',  'volunteer',  'Volunteer',          'Volunteered to make the event happen.',                'heart',      'rose',    now()),
  ('badge_crew',       'crew',       'Organizing crew',    'Part of the team that organized the event.',           'ticket',     'slate',   now()),
  ('badge_committee',  'committee',  'Program committee',  'Reviewed proposals and shaped the programme.',          'clipboard',  'sky',     now());
