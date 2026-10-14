import {
  EventStatus,
  RequestSource,
  SongRequestStatus,
  type SongRequest,
} from "@prisma/client";
import { db } from "@/lib/db";
import { publish } from "@/lib/realtime/bus";
import { EventServiceError, getEventForDj } from "@/lib/services/events";
import { upsertAudienceParticipant } from "@/lib/services/participants";

const OPEN_STATUSES: SongRequestStatus[] = [
  SongRequestStatus.REQUESTED,
  SongRequestStatus.TRENDING,
  SongRequestStatus.ACCEPTED,
];

export class SongRequestServiceError extends Error {
  constructor(
    message: string,
    public readonly code: "NOT_FOUND" | "INVALID" | "NOT_LIVE" | "FORBIDDEN",
  ) {
    super(message);
    this.name = "SongRequestServiceError";
  }
}

/** Safe shape for the DJ board — never includes raw phone numbers. */
export type SongRequestBoardItem = {
  id: string;
  title: string;
  artist: string;
  note: string | null;
  status: SongRequestStatus;
  source: RequestSource;
  isPriority: boolean;
  voteCount: number;
  createdAt: string;
  updatedAt: string;
  guestLabel: string | null;
};

export function toBoardItem(row: {
  id: string;
  title: string;
  artist: string;
  note: string | null;
  status: SongRequestStatus;
  source: RequestSource;
  isPriority: boolean;
  voteCount: number;
  createdAt: Date;
  updatedAt: Date;
  participant: {
    displayLabel: string | null;
    phoneE164: string | null;
  } | null;
}): SongRequestBoardItem {
  return {
    id: row.id,
    title: row.title,
    artist: row.artist,
    note: row.note,
    status: row.status,
    source: row.source,
    isPriority: row.isPriority,
    voteCount: row.voteCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    guestLabel: guestLabelForParticipant(row.participant),
  };
}

/** Masked guest label for DJ UI — never expose full E.164. */
export function guestLabelForParticipant(
  participant: {
    displayLabel: string | null;
    phoneE164: string | null;
  } | null,
): string | null {
  if (!participant) return null;
  const label = participant.displayLabel?.trim();
  if (label) return label;
  const phone = participant.phoneE164?.trim();
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return "Guest";
  return `•••${digits.slice(-4)}`;
}

export async function listSongRequestsForDj(
  eventId: string,
  djProfileId: string,
): Promise<SongRequestBoardItem[]> {
  try {
    await getEventForDj(eventId, djProfileId);
  } catch (error) {
    if (error instanceof EventServiceError) {
      throw new SongRequestServiceError(
        error.message,
        error.code === "FORBIDDEN" ? "FORBIDDEN" : "NOT_FOUND",
      );
    }
    throw error;
  }

  const rows = await db.songRequest.findMany({
    where: { eventId },
    include: {
      participant: {
        select: { displayLabel: true, phoneE164: true },
      },
    },
    orderBy: [{ voteCount: "desc" }, { createdAt: "desc" }],
  });

  return rows.map(toBoardItem);
}

/** lowercased, punctuation-stripped `title|artist` for per-event dedupe */
export function normalizeSongKey(title: string, artist: string): string {
  return `${normalizePart(title)}|${normalizePart(artist)}`;
}

function normalizePart(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

export type CreateSongRequestInput = {
  eventId: string;
  title: string;
  artist: string;
  note?: string | null;
  source?: RequestSource;
  sessionToken?: string | null;
  phoneE164?: string | null;
};

export type CreateSongRequestResult = {
  songRequest: SongRequest;
  created: boolean;
  upvoted: boolean;
};

export async function createSongRequest(
  input: CreateSongRequestInput,
): Promise<CreateSongRequestResult> {
  const title = input.title.trim();
  const artist = input.artist.trim();
  const note = input.note?.trim() || null;
  const source = input.source ?? RequestSource.WEB;

  if (title.length < 1 || title.length > 160) {
    throw new SongRequestServiceError("Song title is required", "INVALID");
  }
  if (artist.length < 1 || artist.length > 160) {
    throw new SongRequestServiceError("Artist is required", "INVALID");
  }
  if (note && note.length > 280) {
    throw new SongRequestServiceError("Note is too long", "INVALID");
  }

  const normalizedKey = normalizeSongKey(title, artist);
  if (!normalizedKey.includes("|") || normalizedKey === "|") {
    throw new SongRequestServiceError("Song title and artist are required", "INVALID");
  }
  const [normTitle, normArtist] = normalizedKey.split("|");
  if (!normTitle || !normArtist) {
    throw new SongRequestServiceError("Song title and artist are required", "INVALID");
  }

  const event = await db.event.findUnique({ where: { id: input.eventId } });
  if (!event) {
    throw new SongRequestServiceError("Event not found", "NOT_FOUND");
  }
  if (event.status !== EventStatus.LIVE) {
    throw new SongRequestServiceError(
      "Requests are only accepted while the event is live",
      "NOT_LIVE",
    );
  }

  const participantId = await upsertAudienceParticipant({
    eventId: event.id,
    sessionToken: input.sessionToken,
    phoneE164: input.phoneE164,
  });

  const existing = await db.songRequest.findUnique({
    where: {
      eventId_normalizedKey: {
        eventId: event.id,
        normalizedKey,
      },
    },
  });

  if (existing && OPEN_STATUSES.includes(existing.status)) {
    const songRequest = await db.$transaction(async (tx) => {
      let shouldIncrement = true;

      if (participantId) {
        const priorVote = await tx.songVote.findUnique({
          where: {
            songRequestId_participantId: {
              songRequestId: existing.id,
              participantId,
            },
          },
        });
        if (priorVote) {
          shouldIncrement = false;
        } else {
          await tx.songVote.create({
            data: {
              songRequestId: existing.id,
              participantId,
            },
          });
        }
      }

      const updated = await tx.songRequest.update({
        where: { id: existing.id },
        data: {
          ...(shouldIncrement ? { voteCount: { increment: 1 } } : {}),
          ...(participantId && !existing.participantId
            ? { participantId }
            : {}),
        },
      });

      if (shouldIncrement) {
        await tx.eventActivity.create({
          data: {
            eventId: event.id,
            type: "request.upvoted",
            payload: {
              songRequestId: updated.id,
              voteCount: updated.voteCount,
              title: updated.title,
              artist: updated.artist,
            },
          },
        });
      }

      return updated;
    });

    if (
      // Re-publish when the vote count changed; same-guest repeats stay quiet.
      songRequest.voteCount !== existing.voteCount
    ) {
      publish(event.id, "request.upvoted", {
        songRequest: await loadBoardItem(songRequest.id),
      });
    }

    return {
      songRequest,
      created: false,
      upvoted: songRequest.voteCount !== existing.voteCount,
    };
  }

  const songRequest = await db.$transaction(async (tx) => {
    const row = existing
      ? await tx.songRequest.update({
          where: { id: existing.id },
          data: {
            title,
            artist,
            note,
            normalizedKey,
            status: SongRequestStatus.REQUESTED,
            source,
            isPriority: false,
            voteCount: 1,
            participantId: participantId ?? existing.participantId,
          },
        })
      : await tx.songRequest.create({
          data: {
            eventId: event.id,
            title,
            artist,
            note,
            normalizedKey,
            status: SongRequestStatus.REQUESTED,
            source,
            voteCount: 1,
            participantId,
          },
        });

    if (participantId) {
      await tx.songVote.upsert({
        where: {
          songRequestId_participantId: {
            songRequestId: row.id,
            participantId,
          },
        },
        create: {
          songRequestId: row.id,
          participantId,
        },
        update: {},
      });
    }

    await tx.eventActivity.create({
      data: {
        eventId: event.id,
        type: "request.created",
        payload: {
          songRequestId: row.id,
          title: row.title,
          artist: row.artist,
          note: row.note,
          source: row.source,
          voteCount: row.voteCount,
          reopened: Boolean(existing),
        },
      },
    });

    return row;
  });

  publish(event.id, "request.created", {
    songRequest: await loadBoardItem(songRequest.id),
  });

  return { songRequest, created: true, upvoted: false };
}

async function loadBoardItem(id: string): Promise<SongRequestBoardItem> {
  const row = await db.songRequest.findUniqueOrThrow({
    where: { id },
    include: {
      participant: {
        select: { displayLabel: true, phoneE164: true },
      },
    },
  });
  return toBoardItem(row);
}

