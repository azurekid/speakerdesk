-- CreateEnum
CREATE TYPE "PackageKind" AS ENUM ('TIER', 'ADDON');

-- CreateEnum
CREATE TYPE "SponsorshipStatus" AS ENUM ('APPLIED', 'APPROVED', 'INVOICED', 'PAID', 'DECLINED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "AccountRole" ADD VALUE 'SPONSOR';

-- AlterTable
ALTER TABLE "event" ADD COLUMN     "address" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "budgetTarget" INTEGER,
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'EUR',
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION,
ADD COLUMN     "otherIncome" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "prospectusIntro" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "sponsorshipOpen" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "proposal" ADD COLUMN     "requirements" TEXT[],
ADD COLUMN     "requirementsNote" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "sponsor_package" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "kind" "PackageKind" NOT NULL DEFAULT 'TIER',
    "name" TEXT NOT NULL,
    "tagline" TEXT NOT NULL DEFAULT '',
    "price" INTEGER NOT NULL,
    "quantity" INTEGER,
    "benefits" TEXT[],
    "deliverables" TEXT[],
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sponsor_package_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sponsor_org" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "website" TEXT NOT NULL DEFAULT '',
    "logoUrl" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "contactName" TEXT NOT NULL DEFAULT '',
    "contactEmail" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sponsor_org_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sponsorship" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "sponsorOrgId" TEXT NOT NULL,
    "status" "SponsorshipStatus" NOT NULL DEFAULT 'APPLIED',
    "requirements" TEXT[],
    "requirementsNote" TEXT NOT NULL DEFAULT '',
    "message" TEXT NOT NULL DEFAULT '',
    "organizerNote" TEXT NOT NULL DEFAULT '',
    "completedDeliverables" TEXT[],
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sponsorship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sponsorship_item" (
    "id" TEXT NOT NULL,
    "sponsorshipId" TEXT NOT NULL,
    "packageId" TEXT,
    "kind" "PackageKind" NOT NULL,
    "name" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "deliverables" TEXT[],

    CONSTRAINT "sponsorship_item_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sponsor_package_eventId_kind_idx" ON "sponsor_package"("eventId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "sponsor_org_ownerId_key" ON "sponsor_org"("ownerId");

-- CreateIndex
CREATE INDEX "sponsorship_eventId_status_idx" ON "sponsorship"("eventId", "status");

-- CreateIndex
CREATE INDEX "sponsorship_sponsorOrgId_idx" ON "sponsorship"("sponsorOrgId");

-- CreateIndex
CREATE INDEX "sponsorship_item_packageId_idx" ON "sponsorship_item"("packageId");

-- AddForeignKey
ALTER TABLE "sponsor_package" ADD CONSTRAINT "sponsor_package_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sponsor_org" ADD CONSTRAINT "sponsor_org_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sponsorship" ADD CONSTRAINT "sponsorship_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sponsorship" ADD CONSTRAINT "sponsorship_sponsorOrgId_fkey" FOREIGN KEY ("sponsorOrgId") REFERENCES "sponsor_org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sponsorship_item" ADD CONSTRAINT "sponsorship_item_sponsorshipId_fkey" FOREIGN KEY ("sponsorshipId") REFERENCES "sponsorship"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sponsorship_item" ADD CONSTRAINT "sponsorship_item_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "sponsor_package"("id") ON DELETE SET NULL ON UPDATE CASCADE;
