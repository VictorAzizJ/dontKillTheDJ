import {
  EventStatus,
  RequestSource,
  SongRequestStatus,
  type Event,
  type SongRequest,
} from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { dbMock, publishMock } = vi.hoisted(() => ({
  dbMock: {
    event: { findUnique: vi.fn() },
    songRequest: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    eventParticipant: { upsert: vi.fn() },
    $transaction: vi.fn(),
  },
  publishMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/realtime/bus", () => ({ publish: publishMock }));

import {
  createSongRequest,
  normalizeSongKey,
} from "@/lib/services/song-requests";

function makeEvent(overrides: Partial<Event> = {}): Event {
  return {
    id: "event-1",
    name: "Friday Night Live",
    slug: "neon-room-friday",
    status: EventStatus.LIVE,
    venueId: "venue-1",
    djProfileId: "dj-1",
    startedAt: new Date("2026-01-01T20:00:00.000Z"),
    endedAt: null,
    createdAt: new Date("2026-01-01T18:00:00.000Z"),
    updatedAt: new Date("2026-01-01T18:00:00.000Z"),
    ...overrides,
  };
}

function makeSongRequest(overrides: Partial<SongRequest> = {}): SongRequest {
  return {
    id: "req-1",
    eventId: "event-1",
    participantId: null,
    title: "Blinding Lights",
    artist: "The Weeknd",
    note: null,
    normalizedKey: "blinding lights|the weeknd",
    status: SongRequestStatus.REQUESTED,
    source: RequestSource.WEB,
    isPriority: false,
    voteCount: 1,
    createdAt: new Date("2026-01-01T20:05:00.000Z"),
    updatedAt: new Date("2026-01-01T20:05:00.000Z"),
    ...overrides,
  };
}

describe("normalizeSongKey", () => {
  it("lowercases and strips punctuation for title|artist", () => {
    expect(normalizeSongKey("Blinding Lights!", "The Weeknd")).toBe(
      "blinding lights|the weeknd",
    );
  });

  it("collapses whitespace and ignores decorative punctuation", () => {
    expect(normalizeSongKey("  Don't  Stop  ", "Mötley Crüe.")).toBe(
      "dont stop|mötley crüe",
    );
  });

  it("treats punctuation-only differences as the same key", () => {
    const a = normalizeSongKey("Uptown Funk", "Mark Ronson");
    const b = normalizeSongKey("uptown funk!!!", "mark ronson.");
    expect(a).toBe(b);
    expect(a).toBe("uptown funk|mark ronson");
  });
});

describe("createSongRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects requests when the event is not live", async () => {
    dbMock.event.findUnique.mockResolvedValue(
      makeEvent({ status: EventStatus.DRAFT }),
    );

    await expect(
      createSongRequest({
        eventId: "event-1",
        title: "Blinding Lights",
        artist: "The Weeknd",
      }),
    ).rejects.toMatchObject({
      name: "SongRequestServiceError",
      code: "NOT_LIVE",
      message: "Requests are only accepted while the event is live",
    });

    expect(dbMock.songRequest.findUnique).not.toHaveBeenCalled();
    expect(dbMock.$transaction).not.toHaveBeenCalled();
    expect(publishMock).not.toHaveBeenCalled();
  });

  it.each([EventStatus.PAUSED, EventStatus.ENDED] as const)(
    "rejects requests when status is %s",
    async (status) => {
      dbMock.event.findUnique.mockResolvedValue(makeEvent({ status }));

      await expect(
        createSongRequest({
          eventId: "event-1",
          title: "Levitating",
          artist: "Dua Lipa",
        }),
      ).rejects.toMatchObject({
        name: "SongRequestServiceError",
        code: "NOT_LIVE",
      });
      expect(dbMock.$transaction).not.toHaveBeenCalled();
    },
  );

  it("upvotes an open duplicate instead of creating a second row", async () => {
    const existing = makeSongRequest({ voteCount: 2 });
    const updated = makeSongRequest({
      voteCount: 3,
      updatedAt: new Date("2026-01-01T20:10:00.000Z"),
    });
    const boardRow = {
      ...updated,
      participant: null,
    };

    dbMock.event.findUnique.mockResolvedValue(makeEvent());
    dbMock.songRequest.findUnique.mockResolvedValue(existing);
    dbMock.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
      const tx = {
        songVote: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn() },
        songRequest: { update: vi.fn().mockResolvedValue(updated) },
        eventActivity: { create: vi.fn().mockResolvedValue({}) },
      };
      return fn(tx);
    });
    dbMock.songRequest.findUniqueOrThrow.mockResolvedValue(boardRow);

    const result = await createSongRequest({
      eventId: "event-1",
      title: "Blinding Lights!!!",
      artist: "the weeknd",
    });

    expect(result).toEqual({
      songRequest: updated,
      created: false,
      upvoted: true,
    });
    expect(dbMock.songRequest.findUnique).toHaveBeenCalledWith({
      where: {
        eventId_normalizedKey: {
          eventId: "event-1",
          normalizedKey: "blinding lights|the weeknd",
        },
      },
    });
    expect(publishMock).toHaveBeenCalledWith(
      "event-1",
      "request.upvoted",
      expect.objectContaining({
        songRequest: expect.objectContaining({ id: "req-1", voteCount: 3 }),
      }),
    );
  });
});
