import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import {
  EventServiceError,
  createEvent,
  getDjProfileForUser,
  listEventsForDj,
  publicEventUrl,
} from "@/lib/services/events";

const createSchema = z.object({
  name: z.string().trim().min(2).max(120),
  venueId: z.string().min(1),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dj = await getDjProfileForUser(session.user.id);
  if (!dj) {
    return NextResponse.json({ error: "DJ profile required" }, { status: 403 });
  }

  const events = await listEventsForDj(dj.id);
  return NextResponse.json({
    events: events.map((event) => ({
      ...event,
      publicUrl: publicEventUrl(event),
    })),
  });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dj = await getDjProfileForUser(session.user.id);
  if (!dj) {
    return NextResponse.json({ error: "DJ profile required" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid event payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const event = await createEvent({
      name: parsed.data.name,
      venueId: parsed.data.venueId,
      djProfileId: dj.id,
    });
    return NextResponse.json(
      { event: { ...event, publicUrl: publicEventUrl(event) } },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof EventServiceError) {
      const status =
        error.code === "NOT_FOUND"
          ? 404
          : error.code === "FORBIDDEN"
            ? 403
            : error.code === "CONFLICT"
              ? 409
              : 400;
      return NextResponse.json({ error: error.message }, { status });
    }
    throw error;
  }
}
