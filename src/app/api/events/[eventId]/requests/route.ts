import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { getDjProfileForUser } from "@/lib/services/events";
import {
  SongRequestServiceError,
  createSongRequest,
  listSongRequestsForDj,
} from "@/lib/services/song-requests";

const createSchema = z.object({
  title: z.string().trim().min(1).max(160),
  artist: z.string().trim().min(1).max(160),
  note: z.string().trim().max(280).optional().nullable(),
  sessionToken: z.string().trim().min(8).max(128).optional().nullable(),
});

/** DJ board poll / initial fetch — auth required. */
export async function GET(
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
    const requests = await listSongRequestsForDj(eventId, dj.id);
    return NextResponse.json({ requests });
  } catch (error) {
    if (error instanceof SongRequestServiceError) {
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

export async function POST(
  request: Request,
  context: { params: Promise<{ eventId: string }> },
) {
  const { eventId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const result = await createSongRequest({
      eventId,
      title: parsed.data.title,
      artist: parsed.data.artist,
      note: parsed.data.note,
      sessionToken: parsed.data.sessionToken,
    });

    return NextResponse.json(
      {
        songRequest: result.songRequest,
        created: result.created,
        upvoted: result.upvoted,
      },
      { status: result.created ? 201 : 200 },
    );
  } catch (error) {
    if (error instanceof SongRequestServiceError) {
      const status =
        error.code === "NOT_FOUND"
          ? 404
          : error.code === "NOT_LIVE"
            ? 409
            : 400;
      return NextResponse.json({ error: error.message }, { status });
    }
    throw error;
  }
}
