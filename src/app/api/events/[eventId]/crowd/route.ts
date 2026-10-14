import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { CrowdServiceError, getCrowdReadingForDj } from "@/lib/services/crowd";
import { getDjProfileForUser } from "@/lib/services/events";

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
    const reading = await getCrowdReadingForDj(eventId, dj.id);
    return NextResponse.json({ reading });
  } catch (error) {
    if (error instanceof CrowdServiceError) {
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
