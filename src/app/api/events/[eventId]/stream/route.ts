import { auth } from "@/auth";
import { subscribe, type RealtimeMessage } from "@/lib/realtime/bus";
import {
  EventServiceError,
  getDjProfileForUser,
  getEventForDj,
} from "@/lib/services/events";

function encodeSse(data: unknown): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`);
}

function encodeComment(comment: string): Uint8Array {
  return new TextEncoder().encode(`: ${comment}\n\n`);
}

export async function GET(
  request: Request,
  context: { params: Promise<{ eventId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const dj = await getDjProfileForUser(session.user.id);
  if (!dj) {
    return new Response(JSON.stringify({ error: "DJ profile required" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { eventId } = await context.params;

  try {
    await getEventForDj(eventId, dj.id);
  } catch (error) {
    if (error instanceof EventServiceError) {
      const status = error.code === "FORBIDDEN" ? 403 : 404;
      return new Response(JSON.stringify({ error: error.message }), {
        status,
        headers: { "Content-Type": "application/json" },
      });
    }
    throw error;
  }

  let cleanup: (() => void) | undefined;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (message: RealtimeMessage) => {
        try {
          controller.enqueue(encodeSse(message));
        } catch {
          cleanup?.();
        }
      };

      const unsubscribe = subscribe(eventId, send);
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encodeComment("ping"));
        } catch {
          cleanup?.();
        }
      }, 15_000);

      cleanup = () => {
        clearInterval(heartbeat);
        unsubscribe();
      };

      send({ type: "connected", eventId, payload: null });

      const onAbort = () => {
        cleanup?.();
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      if (request.signal.aborted) {
        onAbort();
        return;
      }
      request.signal.addEventListener("abort", onAbort);
    },
    cancel() {
      cleanup?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
