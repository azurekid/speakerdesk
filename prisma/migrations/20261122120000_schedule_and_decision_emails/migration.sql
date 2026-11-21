-- Decision emails, speaker confirmation after acceptance, and the schedule (rooms, slots, breaks).


-- CreateEnum
CREATE TYPE "SpeakerConfirmation" AS ENUM ('PENDING', 'CONFIRMED', 'DECLINED');

-- AlterTable
ALTER TABLE "event" ADD COLUMN     "decisionEmails" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "decisionEmailsEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "schedulePublished" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'Europe/Amsterdam';

-- AlterTable
ALTER TABLE "proposal" ADD COLUMN     "confirmation" "SpeakerConfirmation",
ADD COLUMN     "confirmationNote" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "confirmedAt" TIMESTAMP(3),
ADD COLUMN     "roomId" TEXT,
ADD COLUMN     "slotDay" DATE,
ADD COLUMN     "slotNotified" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "slotStart" INTEGER;

-- CreateTable
CREATE TABLE "schedule_room" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "capacity" INTEGER,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "schedule_room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedule_item" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "roomId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "schedule_item_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "schedule_room_eventId_idx" ON "schedule_room"("eventId");

-- CreateIndex
CREATE INDEX "schedule_item_eventId_day_idx" ON "schedule_item"("eventId", "day");

-- CreateIndex
CREATE INDEX "schedule_item_roomId_idx" ON "schedule_item"("roomId");

-- CreateIndex
CREATE INDEX "proposal_roomId_idx" ON "proposal"("roomId");

-- AddForeignKey
ALTER TABLE "proposal" ADD CONSTRAINT "proposal_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "schedule_room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_room" ADD CONSTRAINT "schedule_room_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_item" ADD CONSTRAINT "schedule_item_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_item" ADD CONSTRAINT "schedule_item_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "schedule_room"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Acceptances already sent: invited speakers said yes when they accepted the invitation;
-- everyone else is asked to confirm.
UPDATE "proposal" SET "confirmation" = CASE WHEN "invited" THEN 'CONFIRMED'::"SpeakerConfirmation" ELSE 'PENDING'::"SpeakerConfirmation" END
WHERE "decision" = 'ACCEPTED' AND "decisionPublished" = true AND "withdrawn" = false;
