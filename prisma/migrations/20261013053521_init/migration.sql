-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('DRAFT', 'LIVE', 'PAUSED', 'ENDED');

-- CreateEnum
CREATE TYPE "SongRequestStatus" AS ENUM ('REQUESTED', 'TRENDING', 'ACCEPTED', 'PLAYED', 'DECLINED');

-- CreateEnum
CREATE TYPE "RequestSource" AS ENUM ('WEB', 'SMS', 'VOICE');

-- CreateEnum
CREATE TYPE "TipStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "TipKind" AS ENUM ('TIP', 'PRIORITY_REQUEST');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DJProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stageName" TEXT NOT NULL,
    "bio" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DJProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Venue" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Venue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "EventStatus" NOT NULL DEFAULT 'DRAFT',
    "venueId" TEXT NOT NULL,
    "djProfileId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventParticipant" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "sessionToken" TEXT,
    "phoneE164" TEXT,
    "displayLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SongRequest" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "participantId" TEXT,
    "title" TEXT NOT NULL,
    "artist" TEXT NOT NULL,
    "note" TEXT,
    "normalizedKey" TEXT NOT NULL,
    "status" "SongRequestStatus" NOT NULL DEFAULT 'REQUESTED',
    "source" "RequestSource" NOT NULL DEFAULT 'WEB',
    "isPriority" BOOLEAN NOT NULL DEFAULT false,
    "voteCount" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SongRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SongVote" (
    "id" TEXT NOT NULL,
    "songRequestId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SongVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VibeVote" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VibeVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DJRating" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "djProfileId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "stars" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DJRating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tip" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "participantId" TEXT,
    "songRequestId" TEXT,
    "kind" "TipKind" NOT NULL DEFAULT 'TIP',
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "status" "TipStatus" NOT NULL DEFAULT 'PENDING',
    "stripeSessionId" TEXT,
    "stripePaymentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TwilioMessage" (
    "id" TEXT NOT NULL,
    "eventId" TEXT,
    "messageSid" TEXT NOT NULL,
    "fromPhone" TEXT NOT NULL,
    "toPhone" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TwilioMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoiceInteraction" (
    "id" TEXT NOT NULL,
    "eventId" TEXT,
    "callSid" TEXT NOT NULL,
    "fromPhone" TEXT NOT NULL,
    "toPhone" TEXT NOT NULL,
    "digits" TEXT,
    "speechResult" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VoiceInteraction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventActivity" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "DJProfile_userId_key" ON "DJProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Event_slug_key" ON "Event"("slug");

-- CreateIndex
CREATE INDEX "EventParticipant_eventId_idx" ON "EventParticipant"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "EventParticipant_eventId_sessionToken_key" ON "EventParticipant"("eventId", "sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "EventParticipant_eventId_phoneE164_key" ON "EventParticipant"("eventId", "phoneE164");

-- CreateIndex
CREATE INDEX "SongRequest_eventId_status_idx" ON "SongRequest"("eventId", "status");

-- CreateIndex
CREATE INDEX "SongRequest_eventId_createdAt_idx" ON "SongRequest"("eventId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SongRequest_eventId_normalizedKey_key" ON "SongRequest"("eventId", "normalizedKey");

-- CreateIndex
CREATE INDEX "SongVote_songRequestId_idx" ON "SongVote"("songRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "SongVote_songRequestId_participantId_key" ON "SongVote"("songRequestId", "participantId");

-- CreateIndex
CREATE INDEX "VibeVote_eventId_createdAt_idx" ON "VibeVote"("eventId", "createdAt");

-- CreateIndex
CREATE INDEX "VibeVote_participantId_createdAt_idx" ON "VibeVote"("participantId", "createdAt");

-- CreateIndex
CREATE INDEX "DJRating_djProfileId_idx" ON "DJRating"("djProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "DJRating_eventId_participantId_key" ON "DJRating"("eventId", "participantId");

-- CreateIndex
CREATE UNIQUE INDEX "Tip_stripeSessionId_key" ON "Tip"("stripeSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "Tip_stripePaymentId_key" ON "Tip"("stripePaymentId");

-- CreateIndex
CREATE INDEX "Tip_eventId_status_idx" ON "Tip"("eventId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TwilioMessage_messageSid_key" ON "TwilioMessage"("messageSid");

-- CreateIndex
CREATE INDEX "TwilioMessage_eventId_idx" ON "TwilioMessage"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "VoiceInteraction_callSid_key" ON "VoiceInteraction"("callSid");

-- CreateIndex
CREATE INDEX "VoiceInteraction_eventId_idx" ON "VoiceInteraction"("eventId");

-- CreateIndex
CREATE INDEX "EventActivity_eventId_createdAt_idx" ON "EventActivity"("eventId", "createdAt");

-- AddForeignKey
ALTER TABLE "DJProfile" ADD CONSTRAINT "DJProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_djProfileId_fkey" FOREIGN KEY ("djProfileId") REFERENCES "DJProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventParticipant" ADD CONSTRAINT "EventParticipant_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SongRequest" ADD CONSTRAINT "SongRequest_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SongRequest" ADD CONSTRAINT "SongRequest_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "EventParticipant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SongVote" ADD CONSTRAINT "SongVote_songRequestId_fkey" FOREIGN KEY ("songRequestId") REFERENCES "SongRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SongVote" ADD CONSTRAINT "SongVote_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "EventParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VibeVote" ADD CONSTRAINT "VibeVote_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VibeVote" ADD CONSTRAINT "VibeVote_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "EventParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DJRating" ADD CONSTRAINT "DJRating_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DJRating" ADD CONSTRAINT "DJRating_djProfileId_fkey" FOREIGN KEY ("djProfileId") REFERENCES "DJProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DJRating" ADD CONSTRAINT "DJRating_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "EventParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tip" ADD CONSTRAINT "Tip_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tip" ADD CONSTRAINT "Tip_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "EventParticipant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tip" ADD CONSTRAINT "Tip_songRequestId_fkey" FOREIGN KEY ("songRequestId") REFERENCES "SongRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TwilioMessage" ADD CONSTRAINT "TwilioMessage_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceInteraction" ADD CONSTRAINT "VoiceInteraction_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventActivity" ADD CONSTRAINT "EventActivity_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
