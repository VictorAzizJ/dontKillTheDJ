export type RealtimeMessage = {
  type: string;
  eventId: string;
  payload: unknown;
};

type Handler = (message: RealtimeMessage) => void;

const globalForBus = globalThis as unknown as {
  __crowdControlBus?: Map<string, Set<Handler>>;
};

function channels(): Map<string, Set<Handler>> {
  if (!globalForBus.__crowdControlBus) {
    globalForBus.__crowdControlBus = new Map();
  }
  return globalForBus.__crowdControlBus;
}

/** Publish a realtime message for an event. Same call site can later target Ably/Supabase. */
export function publish(
  eventId: string,
  type: string,
  payload: unknown = null,
): void {
  const handlers = channels().get(eventId);
  if (!handlers?.size) return;

  const message: RealtimeMessage = { type, eventId, payload };
  for (const handler of handlers) {
    try {
      handler(message);
    } catch {
      // Subscriber errors must not break the publish loop.
    }
  }
}

export function subscribe(eventId: string, handler: Handler): () => void {
  const map = channels();
  let set = map.get(eventId);
  if (!set) {
    set = new Set();
    map.set(eventId, set);
  }
  set.add(handler);

  return () => {
    set!.delete(handler);
    if (set!.size === 0) {
      map.delete(eventId);
    }
  };
}
