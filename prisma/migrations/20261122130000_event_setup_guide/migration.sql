-- Per-member choice to hide the event setup guide on the event overview.
ALTER TABLE "event_member" ADD COLUMN "guideHidden" BOOLEAN NOT NULL DEFAULT false;
