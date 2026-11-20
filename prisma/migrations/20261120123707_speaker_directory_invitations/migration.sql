-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'WITHDRAWN');

-- AlterTable
ALTER TABLE "proposal" ADD COLUMN     "invited" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "speaker_profile" ADD COLUMN     "availabilityNote" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "openToInvites" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "publicProfile" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "slug" TEXT,
ADD COLUMN     "topics" TEXT[];

-- AlterTable
ALTER TABLE "talk" ADD COLUMN     "published" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "speaker_invitation" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "speakerId" TEXT NOT NULL,
    "talkId" TEXT,
    "invitedById" TEXT,
    "message" TEXT NOT NULL DEFAULT '',
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "responseNote" TEXT NOT NULL DEFAULT '',
    "proposalId" TEXT,
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "speaker_invitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "speaker_invitation_speakerId_status_idx" ON "speaker_invitation"("speakerId", "status");

-- CreateIndex
CREATE INDEX "speaker_invitation_eventId_idx" ON "speaker_invitation"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "speaker_profile_slug_key" ON "speaker_profile"("slug");

-- AddForeignKey
ALTER TABLE "speaker_invitation" ADD CONSTRAINT "speaker_invitation_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "speaker_invitation" ADD CONSTRAINT "speaker_invitation_speakerId_fkey" FOREIGN KEY ("speakerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "speaker_invitation" ADD CONSTRAINT "speaker_invitation_talkId_fkey" FOREIGN KEY ("talkId") REFERENCES "talk"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "speaker_invitation" ADD CONSTRAINT "speaker_invitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

