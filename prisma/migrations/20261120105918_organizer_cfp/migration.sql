-- CreateEnum
CREATE TYPE "EventRole" AS ENUM ('OWNER', 'REVIEWER');

-- CreateEnum
CREATE TYPE "Decision" AS ENUM ('UNDECIDED', 'ACCEPTED', 'WAITLISTED', 'REJECTED');

-- AlterEnum
ALTER TYPE "Platform" ADD VALUE 'SPEAKERDESK';

-- CreateTable
CREATE TABLE "event" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tagline" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "location" TEXT NOT NULL DEFAULT '',
    "venue" TEXT NOT NULL DEFAULT '',
    "website" TEXT NOT NULL DEFAULT '',
    "coverImage" TEXT NOT NULL DEFAULT '/images/events/main-stage.jpg',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "cfpPublished" BOOLEAN NOT NULL DEFAULT false,
    "cfpOpensAt" TIMESTAMP(3),
    "cfpClosesAt" TIMESTAMP(3),
    "cfpGuidelines" TEXT NOT NULL DEFAULT '',
    "tracks" TEXT[],
    "formats" "TalkFormat"[],
    "titleLimit" INTEGER,
    "abstractLimit" INTEGER,
    "maxProposalsPerSpeaker" INTEGER NOT NULL DEFAULT 3,
    "blindReview" BOOLEAN NOT NULL DEFAULT false,
    "programPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_member" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "EventRole" NOT NULL DEFAULT 'REVIEWER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposal" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "speakerId" TEXT NOT NULL,
    "talkId" TEXT,
    "submissionId" TEXT,
    "title" TEXT NOT NULL,
    "abstract" TEXT NOT NULL,
    "takeaways" TEXT[],
    "format" "TalkFormat" NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "level" "TalkLevel" NOT NULL,
    "track" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "withdrawn" BOOLEAN NOT NULL DEFAULT false,
    "decision" "Decision" NOT NULL DEFAULT 'UNDECIDED',
    "decisionPublished" BOOLEAN NOT NULL DEFAULT false,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "comment" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "review_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "event_slug_key" ON "event"("slug");

-- CreateIndex
CREATE INDEX "event_cfpPublished_cfpClosesAt_idx" ON "event"("cfpPublished", "cfpClosesAt");

-- CreateIndex
CREATE INDEX "event_member_userId_idx" ON "event_member"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "event_member_eventId_userId_key" ON "event_member"("eventId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "proposal_submissionId_key" ON "proposal"("submissionId");

-- CreateIndex
CREATE INDEX "proposal_eventId_decision_idx" ON "proposal"("eventId", "decision");

-- CreateIndex
CREATE INDEX "proposal_speakerId_idx" ON "proposal"("speakerId");

-- CreateIndex
CREATE UNIQUE INDEX "review_proposalId_reviewerId_key" ON "review"("proposalId", "reviewerId");

-- AddForeignKey
ALTER TABLE "event_member" ADD CONSTRAINT "event_member_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_member" ADD CONSTRAINT "event_member_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal" ADD CONSTRAINT "proposal_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal" ADD CONSTRAINT "proposal_speakerId_fkey" FOREIGN KEY ("speakerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal" ADD CONSTRAINT "proposal_talkId_fkey" FOREIGN KEY ("talkId") REFERENCES "talk"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal" ADD CONSTRAINT "proposal_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "submission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review" ADD CONSTRAINT "review_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "proposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review" ADD CONSTRAINT "review_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
