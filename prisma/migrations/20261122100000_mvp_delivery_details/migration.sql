-- Delivery details for reporting a talk to MVP (and similar) portals.
ALTER TABLE "submission" ADD COLUMN "mvpTechnologyArea" TEXT NOT NULL DEFAULT '',
ADD COLUMN "targetAudience" TEXT NOT NULL DEFAULT '',
ADD COLUMN "microsoftEvent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "inPersonAttendees" INTEGER,
ADD COLUMN "liveStreamViews" INTEGER,
ADD COLUMN "onDemandViews" INTEGER;
