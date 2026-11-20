-- Online / in-person / hybrid events, and the per-event submission confirmation email.
CREATE TYPE "EventFormat" AS ENUM ('IN_PERSON', 'ONLINE', 'HYBRID');

ALTER TABLE "event" ADD COLUMN "format" "EventFormat" NOT NULL DEFAULT 'IN_PERSON',
ADD COLUMN "onlinePlatform" TEXT NOT NULL DEFAULT '',
ADD COLUMN "confirmationEmailEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "confirmationEmailSubject" TEXT NOT NULL DEFAULT '',
ADD COLUMN "confirmationEmailBody" TEXT NOT NULL DEFAULT '';

-- Events that already said "Online" as their location become online events.
UPDATE "event" SET "format" = 'ONLINE' WHERE lower(trim("location")) = 'online';
