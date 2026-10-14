import { EventStatus, type Event, type Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { slugifyEventName } from "@/lib/slug";

export class EventServiceError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "NOT_FOUND"
      | "FORBIDDEN"
      | "INVALID"
      | "CONFLICT",
  ) {
    super(message);
    this.name = "EventServiceError";
  }
}

const eventInclude = {
  venue: true,
  djProfile: true,
} satisfies Prisma.EventInclude;

export type EventWithRelations = Prisma.EventGetPayload<{
  include: typeof eventInclude;
}>;

export async function getDjProfileForUser(userId: string) {
  return db.dJProfile.findUnique({ where: { userId } });
}

export async function listVenues() {
  return db.venue.findMany({ orderBy: { name: "asc" } });
}

export async function listEventsForDj(djProfileId: string) {
  return db.event.findMany({
    where: { djProfileId },
    include: eventInclude,
    orderBy: { createdAt: "desc" },
  });
}

export async function getEventForDj(
  eventId: string,
  djProfileId: string,
): Promise<EventWithRelations> {
  const event = await db.event.findUnique({
    where: { id: eventId },
    include: eventInclude,
  });

  if (!event) {
    throw new EventServiceError("Event not found", "NOT_FOUND");
  }
  if (event.djProfileId !== djProfileId) {
    throw new EventServiceError("Not your event", "FORBIDDEN");
  }

  return event;
}

/** Public join page lookup — no auth. */
export async function getPublicEventBySlug(
  slug: string,
): Promise<EventWithRelations | null> {
  return db.event.findUnique({
    where: { slug },
    include: eventInclude,
  });
}

export async function createEvent(input: {
  name: string;
  venueId: string;
  djProfileId: string;
}): Promise<EventWithRelations> {
  const name = input.name.trim();
  if (name.length < 2) {
    throw new EventServiceError("Event name is required", "INVALID");
  }

  const venue = await db.venue.findUnique({ where: { id: input.venueId } });
  if (!venue) {
    throw new EventServiceError("Venue not found", "INVALID");
  }

  let slug = slugifyEventName(name);
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await db.event.create({
        data: {
          name,
          slug,
          venueId: venue.id,
          djProfileId: input.djProfileId,
          status: EventStatus.DRAFT,
        },
        include: eventInclude,
      });
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "P2002"
      ) {
        slug = slugifyEventName(name);
        continue;
      }
      throw error;
    }
  }

  throw new EventServiceError("Could not allocate a unique slug", "CONFLICT");
}

export async function startEvent(
  eventId: string,
  djProfileId: string,
): Promise<EventWithRelations> {
  const event = await getEventForDj(eventId, djProfileId);

  if (event.status === EventStatus.LIVE) {
    return event;
  }

  if (event.status === EventStatus.ENDED) {
    throw new EventServiceError("Ended events cannot be restarted", "INVALID");
  }

  return db.event.update({
    where: { id: event.id },
    data: {
      status: EventStatus.LIVE,
      startedAt: event.startedAt ?? new Date(),
      endedAt: null,
    },
    include: eventInclude,
  });
}

export function publicEventPath(event: Pick<Event, "slug">): string {
  return `/e/${event.slug}`;
}

export function publicEventUrl(event: Pick<Event, "slug">): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );
  return `${base}${publicEventPath(event)}`;
}
