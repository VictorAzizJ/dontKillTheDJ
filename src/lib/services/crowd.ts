import { EventStatus, type CrowdSignalSource } from "@prisma/client";
import {
  aggregateCrowd,
  type CrowdReading,
  type CrowdSample,
} from "@/lib/crowd/reading";
import { db } from "@/lib/db";
import { publish } from "@/lib/realtime/bus";
import { EventServiceError, getEventForDj } from "@/lib/services/events";

const WINDOW_MS = 45 * 60 * 1000;
const MIN_GAP_MS = 12_000;

export class CrowdServiceError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "NOT_FOUND"
      | "NOT_LIVE"
      | "INVALID"
      | "RATE_LIMITED"
      | "FORBIDDEN",
  ) {
    super(message);
    this.name = "CrowdServiceError";
  }
}

export async function getCrowdReadingForDj(
  eventId: string,
  djProfileId: string,
  now = new Date(),
): Promise<CrowdReading> {
  try {
    await getEventForDj(eventId, djProfileId);
  } catch (error) {
    if (error instanceof EventServiceError) {
      throw new CrowdServiceError(
        error.message,
        error.code === "FORBIDDEN" ? "FORBIDDEN" : "NOT_FOUND",
      );
    }
    throw error;
  }

  return loadCrowdReading(eventId, now);
}

export async function loadCrowdReading(
  eventId: string,
  now = new Date(),
): Promise<CrowdReading> {
  const since = new Date(now.getTime() - WINDOW_MS);
  const rows = await db.crowdSignal.findMany({
    where: { eventId, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    take: 400,
  });

  const samples: CrowdSample[] = rows.map((row) => ({
    energy: row.energy,
    sentiment: row.sentiment,
    label: row.label,
    reader: row.reader,
    createdAt: row.createdAt,
  }));

  return aggregateCrowd(samples, now);
}

export async function recordCrowdSignal(input: {
  eventId: string;
  participantId: string;
  source: CrowdSignalSource;
  reader: string;
  energy: number;
  sentiment: number;
  label: string;
  vibeScore?: number;
  now?: Date;
}): Promise<CrowdReading> {
  const energy = clamp(input.energy, 0, 1);
  const sentiment = clamp(input.sentiment, -1, 1);
  const label = input.label.replace(/\s+/g, " ").trim().slice(0, 48);
  if (!label) {
    throw new CrowdServiceError("A reading needs a label", "INVALID");
  }
  if (
    input.vibeScore !== undefined &&
    (!Number.isInteger(input.vibeScore) || input.vibeScore < 1 || input.vibeScore > 5)
  ) {
    throw new CrowdServiceError("Vibe score must be from 1 to 5", "INVALID");
  }

  const event = await db.event.findUnique({ where: { id: input.eventId } });
  if (!event) {
    throw new CrowdServiceError("Event not found", "NOT_FOUND");
  }
  if (event.status !== EventStatus.LIVE) {
    throw new CrowdServiceError(
      "Temperature checks are only open while the event is live",
      "NOT_LIVE",
    );
  }

  const now = input.now ?? new Date();
  const latest = await db.crowdSignal.findFirst({
    where: { eventId: event.id, participantId: input.participantId },
    orderBy: { createdAt: "desc" },
  });
  if (latest && now.getTime() - latest.createdAt.getTime() < MIN_GAP_MS) {
    throw new CrowdServiceError(
      "Wait a few seconds before another check",
      "RATE_LIMITED",
    );
  }

  await db.$transaction(async (tx) => {
    await tx.crowdSignal.create({
      data: {
        eventId: event.id,
        participantId: input.participantId,
        source: input.source,
        reader: input.reader,
        energy,
        sentiment,
        label,
        createdAt: now,
      },
    });

    if (input.vibeScore !== undefined) {
      await tx.vibeVote.create({
        data: {
          eventId: event.id,
          participantId: input.participantId,
          score: input.vibeScore,
          createdAt: now,
        },
      });
    }

    await tx.eventActivity.create({
      data: {
        eventId: event.id,
        type: "crowd.signal",
        payload: {
          source: input.source,
          reader: input.reader,
          energy,
          sentiment,
          label,
        },
      },
    });
  });

  const reading = await loadCrowdReading(event.id, now);
  publish(event.id, "crowd.updated", { reading });
  return reading;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
