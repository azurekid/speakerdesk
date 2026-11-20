-- Organizer's choice for how a custom cover image is scaled. Defaults match today's behaviour.
ALTER TABLE "event" ADD COLUMN "coverFit" TEXT NOT NULL DEFAULT 'cover',
ADD COLUMN "coverPosition" TEXT NOT NULL DEFAULT 'center';
