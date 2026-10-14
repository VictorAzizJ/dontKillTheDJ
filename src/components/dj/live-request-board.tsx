"use client";

import { useEffect, useRef, useState } from "react";
import type { SongRequestStatus } from "@prisma/client";
import { Music2, Radio } from "lucide-react";
import type { SongRequestBoardItem } from "@/lib/services/song-requests";
import { cn } from "@/lib/utils";

const POLL_MS = 2000;
const SSE_RETRY_MS = 4000;

type ConnectionMode = "sse" | "poll" | "connecting";

type StreamPayload = {
  songRequest?: SongRequestBoardItem;
};

function sortBoard(items: SongRequestBoardItem[]): SongRequestBoardItem[] {
  return [...items].sort((a, b) => {
    if (b.voteCount !== a.voteCount) return b.voteCount - a.voteCount;
    return b.createdAt.localeCompare(a.createdAt);
  });
}

function upsertFromPayload(
  prev: SongRequestBoardItem[],
  payload: unknown,
): SongRequestBoardItem[] {
  if (!payload || typeof payload !== "object") return prev;
  const songRequest = (payload as StreamPayload).songRequest;
  if (!songRequest?.id) return prev;

  const without = prev.filter((r) => r.id !== songRequest.id);
  return sortBoard([songRequest, ...without]);
}

const statusStyles: Record<SongRequestStatus, string> = {
  REQUESTED: "text-cyan",
  TRENDING: "text-pink",
  ACCEPTED: "text-neon",
  PLAYED: "text-muted-foreground",
  DECLINED: "text-muted-foreground",
};

export function LiveRequestBoard({
  eventId,
  initialRequests,
}: {
  eventId: string;
  initialRequests: SongRequestBoardItem[];
}) {
  const [requests, setRequests] = useState(() => sortBoard(initialRequests));
  const [mode, setMode] = useState<ConnectionMode>("connecting");
  const [error, setError] = useState<string | null>(null);
  const requestsRef = useRef(requests);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    requestsRef.current = requests;
  }, [requests]);

  useEffect(() => {
    setRequests(sortBoard(initialRequests));
  }, [initialRequests]);

  useEffect(() => {
    let disposed = false;

    async function fetchRequests() {
      try {
        const res = await fetch(`/api/events/${eventId}/requests`, {
          cache: "no-store",
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          if (!disposed) {
            setError(data.error ?? "Could not refresh requests.");
          }
          return;
        }
        const data = (await res.json()) as { requests: SongRequestBoardItem[] };
        if (!disposed) {
          setRequests(sortBoard(data.requests));
          setError(null);
        }
      } catch {
        if (!disposed) {
          setError("Could not refresh requests.");
        }
      }
    }

    function stopPolling() {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    }

    function startPolling() {
      if (disposed || pollTimerRef.current) return;
      setMode("poll");
      void fetchRequests();
      pollTimerRef.current = setInterval(() => {
        void fetchRequests();
      }, POLL_MS);
    }

    function clearRetry() {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    }

    function closeEventSource() {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    }

    function connectSse() {
      if (disposed) return;
      clearRetry();
      closeEventSource();
      setMode((prev) => (prev === "poll" ? "poll" : "connecting"));

      const es = new EventSource(`/api/events/${eventId}/stream`);
      eventSourceRef.current = es;

      es.onopen = () => {
        if (disposed) return;
        stopPolling();
        setMode("sse");
        setError(null);
      };

      es.onmessage = (event) => {
        if (disposed) return;
        let message: { type?: string; payload?: unknown };
        try {
          message = JSON.parse(event.data) as {
            type?: string;
            payload?: unknown;
          };
        } catch {
          return;
        }

        if (
          message.type === "request.created" ||
          message.type === "request.upvoted"
        ) {
          setRequests((prev) => upsertFromPayload(prev, message.payload));
        }
      };

      es.onerror = () => {
        if (disposed) return;
        closeEventSource();
        startPolling();
        clearRetry();
        retryTimerRef.current = setTimeout(() => {
          if (!disposed) connectSse();
        }, SSE_RETRY_MS);
      };
    }

    void fetchRequests();
    connectSse();

    return () => {
      disposed = true;
      stopPolling();
      clearRetry();
      closeEventSource();
    };
  }, [eventId]);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Live requests</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Incoming songs from the room. Updates live; falls back to polling if
            the stream drops.
          </p>
        </div>
        <ConnectionBadge mode={mode} />
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {requests.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl bg-surface px-6 py-12 text-center ring-1 ring-white/10">
          <Music2 className="size-8 text-neon/70" aria-hidden />
          <p className="text-muted-foreground text-sm leading-relaxed">
            No requests yet. Share the QR or public link — new songs will show
            here as they come in.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {requests.map((request) => (
            <li
              key={request.id}
              className="flex items-start justify-between gap-4 rounded-xl bg-surface px-4 py-3.5 ring-1 ring-white/10"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <p className="truncate text-base font-medium">{request.title}</p>
                  <span className="text-muted-foreground text-sm">
                    {request.artist}
                  </span>
                </div>
                {request.note ? (
                  <p className="text-muted-foreground mt-1 line-clamp-2 text-sm">
                    {request.note}
                  </p>
                ) : null}
                <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                  <span
                    className={cn(
                      "font-medium tracking-wide uppercase",
                      statusStyles[request.status],
                    )}
                  >
                    {request.status}
                  </span>
                  <span>{request.source}</span>
                  {request.guestLabel ? (
                    <span>{request.guestLabel}</span>
                  ) : null}
                  {request.isPriority ? (
                    <span className="text-pink font-medium">Priority</span>
                  ) : null}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-2xl font-semibold tabular-nums text-cyan">
                  {request.voteCount}
                </p>
                <p className="text-muted-foreground text-[11px] tracking-wide uppercase">
                  votes
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ConnectionBadge({ mode }: { mode: ConnectionMode }) {
  const label =
    mode === "sse" ? "Live" : mode === "poll" ? "Polling" : "Connecting";
  const tone =
    mode === "sse"
      ? "bg-cyan/15 text-cyan ring-cyan/40"
      : mode === "poll"
        ? "bg-neon/15 text-neon ring-neon/40"
        : "bg-muted text-muted-foreground ring-white/10";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium tracking-wide uppercase ring-1",
        tone,
      )}
      title={
        mode === "sse"
          ? "Receiving Server-Sent Events"
          : mode === "poll"
            ? "Stream unavailable — refreshing every 2s"
            : "Opening live stream"
      }
    >
      <Radio className="size-3" aria-hidden />
      {label}
    </span>
  );
}
