-- CreateEnum
CREATE TYPE "CrowdSignalSource" AS ENUM ('WEB', 'SMS_KEYWORD', 'SMS_AGENT');

-- AlterTable
ALTER TABLE "TwilioMessage" ADD COLUMN "replyBody" TEXT;

-- CreateTable
CREATE TABLE "CrowdSignal" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "participantId" TEXT,
    "source" "CrowdSignalSource" NOT NULL,
    "reader" TEXT NOT NULL,
    "energy" DOUBLE PRECISION NOT NULL,
    "sentiment" DOUBLE PRECISION NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrowdSignal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CrowdSignal_eventId_createdAt_idx" ON "CrowdSignal"("eventId", "createdAt");

-- CreateIndex
CREATE INDEX "CrowdSignal_participantId_createdAt_idx" ON "CrowdSignal"("participantId", "createdAt");

-- AddForeignKey
ALTER TABLE "CrowdSignal" ADD CONSTRAINT "CrowdSignal_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrowdSignal" ADD CONSTRAINT "CrowdSignal_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "EventParticipant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
