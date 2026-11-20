-- CreateEnum
CREATE TYPE "AccountRole" AS ENUM ('SPEAKER', 'ORGANIZER');

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "primaryRole" "AccountRole" NOT NULL DEFAULT 'SPEAKER';
