import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  EventServiceError,
  getDjProfileForUser,
  publicEventUrl,
  startEvent,
} from "@/lib/services/events";

export async function POST(
  _request: Request,
  context: { params: Promise<{ eventId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dj = await getDjProfileForUser(session.user.id);
  if (!dj) {
    return NextResponse.json({ error: "DJ profile required" }, { status: 403 });
  }

  const { eventId } = await context.params;

  try {
    const event = await startEvent(eventId, dj.id);
    return NextResponse.json({
      event: { ...event, publicUrl: publicEventUrl(event) },
    });
  } catch (error) {
    if (error instanceof EventServiceError) {
      const status =
        error.code === "NOT_FOUND"
          ? 404
          : error.code === "FORBIDDEN"
            ? 403
            : 400;
      return NextResponse.json({ error: error.message }, { status });
    }
    throw error;
  }
}
