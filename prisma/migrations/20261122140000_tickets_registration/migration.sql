-- Tickets: ticket types, registrations with QR codes, check-in and sponsor-sharing consent.


-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('ACTIVE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RegistrationSource" AS ENUM ('SPEAKERDESK', 'IMPORT', 'MANUAL');

-- AlterTable
ALTER TABLE "event" ADD COLUMN     "registrationCapacity" INTEGER,
ADD COLUMN     "registrationClosesAt" TIMESTAMP(3),
ADD COLUMN     "registrationNote" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "registrationOpen" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sponsorSharingEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ticket_type" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "capacity" INTEGER,
    "priceLabel" TEXT NOT NULL DEFAULT '',
    "published" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ticket_type_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registration" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "ticketTypeId" TEXT,
    "userId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL DEFAULT '',
    "company" TEXT NOT NULL DEFAULT '',
    "jobTitle" TEXT NOT NULL DEFAULT '',
    "status" "RegistrationStatus" NOT NULL DEFAULT 'ACTIVE',
    "source" "RegistrationSource" NOT NULL DEFAULT 'SPEAKERDESK',
    "sourcePlatform" TEXT NOT NULL DEFAULT '',
    "shareWithSponsors" BOOLEAN NOT NULL DEFAULT false,
    "consentAt" TIMESTAMP(3),
    "excludeFromSponsorExport" BOOLEAN NOT NULL DEFAULT false,
    "ticketSentAt" TIMESTAMP(3),
    "checkedInAt" TIMESTAMP(3),
    "checkedInById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "registration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ticket_type_eventId_idx" ON "ticket_type"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "registration_code_key" ON "registration"("code");

-- CreateIndex
CREATE INDEX "registration_eventId_status_idx" ON "registration"("eventId", "status");

-- CreateIndex
CREATE INDEX "registration_eventId_email_idx" ON "registration"("eventId", "email");

-- CreateIndex
CREATE INDEX "registration_userId_idx" ON "registration"("userId");

-- AddForeignKey
ALTER TABLE "ticket_type" ADD CONSTRAINT "ticket_type_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registration" ADD CONSTRAINT "registration_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registration" ADD CONSTRAINT "registration_ticketTypeId_fkey" FOREIGN KEY ("ticketTypeId") REFERENCES "ticket_type"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registration" ADD CONSTRAINT "registration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

