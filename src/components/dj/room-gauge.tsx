"use client";

import { useEffect, useRef, useState } from "react";
import { Radio } from "lucide-react";
import type { CrowdReading } from "@/lib/crowd/reading";
import { cn } from "@/lib/utils";

const POLL_MS = 2000;
const SSE_RETRY_MS = 4000;

const CX = 160;
const CY = 150;
const RADIUS = 108;
const ARC_LENGTH = Math.PI * RADIUS;

type ConnectionMode = "sse" | "poll" | "connecting";

function isReading(value: unknown): value is CrowdReading {
  if (!value || typeof value !== "object") return false;
  const reading = value as CrowdReading;
  return (
    typeof reading.sampleCount === "number" &&
    typeof reading.headline === "string" &&
    Array.isArray(reading.phrases)
  );
}

function needlePoint(temperature: number) {
  const ratio = Math.min(100, Math.max(0, temperature)) / 100;
  const angle = Math.PI - ratio * Math.PI;
  return {
    x: CX + Math.cos(angle) * (RADIUS - 22),
    y: CY - Math.sin(angle) * (RADIUS - 22),
  };
}

const bandTone: Record<NonNullable<CrowdReading["band"]>, string> = {
  cold: "text-cyan",
  cool: "text-cyan",
  warm: "text-neon",
  hot: "text-pink",
  fire: "text-pink",
};

function readerLabel(reader: string): string {
  if (reader === "model") return "Agent";
  if (reader === "lexicon") return "Text";
  if (reader === "keyword") return "SMS";
  return "Room";
}

export function RoomGauge({
  eventId,
  initialReading,
}: {
  eventId: string;
  initialReading: CrowdReading;
}) {
  const [reading, setReading] = useState(initialReading);
  const [mode, setMode] = useState<ConnectionMode>("connecting");
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    let disposed = false;

    async function fetchReading() {
      try {
        const res = await fetch(`/api/events/${eventId}/crowd`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = (await res.json()) as { reading?: unknown };
        if (!disposed && isReading(data.reading)) {
          setReading(data.reading);
        }
      } catch {
        // The stream or the next poll will try again.
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
      void fetchReading();
      pollTimerRef.current = setInterval(() => {
        void fetchReading();
      }, POLL_MS);
    }

    function closeEventSource() {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    }

    function connectSse() {
      if (disposed) return;
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      closeEventSource();
      setMode((prev) => (prev === "poll" ? "poll" : "connecting"));

      const source = new EventSource(`/api/events/${eventId}/stream`);
      eventSourceRef.current = source;

      source.onopen = () => {
        if (disposed) return;
        stopPolling();
        setMode("sse");
      };

      source.onmessage = (event) => {
        if (disposed) return;
        let message: { type?: string; payload?: { reading?: unknown } };
        try {
          message = JSON.parse(event.data) as {
            type?: string;
            payload?: { reading?: unknown };
          };
        } catch {
          return;
        }
        if (message.type === "crowd.updated" && isReading(message.payload?.reading)) {
          setReading(message.payload.reading);
        }
      };

      source.onerror = () => {
        if (disposed) return;
        closeEventSource();
        startPolling();
        retryTimerRef.current = setTimeout(() => {
          if (!disposed) connectSse();
        }, SSE_RETRY_MS);
      };
    }

    void fetchReading();
    connectSse();

    return () => {
      disposed = true;
      stopPolling();
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      closeEventSource();
    };
  }, [eventId]);

  const temperature = reading.temperature;
  const hasReading = temperature !== null;
  const tip = needlePoint(hasReading ? temperature : 0);
  const tone = reading.band ? bandTone[reading.band] : "text-muted-foreground";
  const sentimentPos =
    reading.sentiment === null ? null : ((reading.sentiment + 1) / 2) * 100;
  const dash = hasReading ? (temperature / 100) * ARC_LENGTH : 0;
  const gradientId = `room-temp-${eventId}`;

  return (
    <section className="rounded-2xl bg-surface p-5 ring-1 ring-white/10 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Room temperature</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Energy on the dial. Approval on the bar under it.
          </p>
        </div>
        <ConnectionBadge mode={mode} />
      </div>

      <div className="mt-2 grid gap-6 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)] lg:items-center">
        <div className="mx-auto w-full max-w-[320px]">
          <svg viewBox="0 0 320 196" className="w-full" role="img" aria-labelledby={`${gradientId}-title`}>
            <title id={`${gradientId}-title`}>
              {hasReading
                ? `Room temperature ${temperature}, ${reading.headline}`
                : "Waiting for a temperature reading"}
            </title>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="var(--cyan)" />
                <stop offset="48%" stopColor="var(--neon)" />
                <stop offset="100%" stopColor="var(--pink)" />
              </linearGradient>
            </defs>
            <path
              d={arcPath()}
              fill="none"
              stroke="rgb(255 255 255 / 12%)"
              strokeWidth="14"
              strokeLinecap="round"
            />
            <path
              d={arcPath()}
              fill="none"
              stroke={`url(#${gradientId})`}
              strokeWidth="14"
              strokeLinecap="round"
              strokeDasharray={`${dash} ${ARC_LENGTH}`}
            />
            <line
              x1={CX}
              y1={CY}
              x2={tip.x}
              y2={tip.y}
              className={tone}
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <circle cx={CX} cy={CY} r="6" className={tone} fill="currentColor" />
            <text x="36" y="178" fill="rgb(142 163 179)" fontSize="11">
              Cold
            </text>
            <text x="146" y="28" fill="rgb(142 163 179)" fontSize="11" textAnchor="middle">
              Warm
            </text>
            <text x="250" y="178" fill="rgb(142 163 179)" fontSize="11">
              Fire
            </text>
          </svg>
          <div className="-mt-8 text-center" aria-live="polite">
            <p className={cn("text-5xl font-semibold tabular-nums tracking-tight", tone)}>
              {hasReading ? temperature : "—"}
            </p>
            <p className={cn("mt-1 text-sm font-medium tracking-wide uppercase", tone)}>
              {reading.headline}
            </p>
            <p className="text-muted-foreground mt-1 text-sm">{reading.trendLabel}</p>
          </div>
        </div>

        <div className="flex flex-col gap-5">
          <div>
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm font-medium">Sentiment</p>
              <p className="text-muted-foreground text-sm">
                {reading.moodLabel ?? "No read yet"}
              </p>
            </div>
            <div
              className="relative mt-3 h-3 rounded-full bg-gradient-to-r from-pink via-white/25 to-neon"
              role="meter"
              aria-label="Crowd sentiment"
              aria-valuemin={-1}
              aria-valuemax={1}
              aria-valuenow={reading.sentiment ?? undefined}
              aria-valuetext={reading.moodLabel ?? "No read yet"}
            >
              {sentimentPos !== null ? (
                <span
                  className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground ring-2 ring-background"
                  style={{ left: `${sentimentPos}%` }}
                />
              ) : null}
            </div>
            <div className="text-muted-foreground mt-2 flex justify-between text-[11px] tracking-wide uppercase">
              <span>Negative</span>
              <span>Positive</span>
            </div>
          </div>

          <div>
            <p className="text-sm font-medium">From the room</p>
            {reading.phrases.length === 0 ? (
              <p className="text-muted-foreground mt-2 text-sm">
                Checks from the join page and texts show up here.
              </p>
            ) : (
              <ul className="mt-2 flex flex-col gap-2">
                {reading.phrases.map((phrase) => (
                  <li
                    key={`${phrase.createdAt}-${phrase.label}`}
                    className="flex items-center justify-between gap-3 rounded-lg bg-background px-3 py-2 ring-1 ring-white/10"
                  >
                    <span className="truncate text-sm">{phrase.label}</span>
                    <span className="text-muted-foreground shrink-0 text-[11px] tracking-wide uppercase">
                      {readerLabel(phrase.reader)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-muted-foreground mt-3 text-xs">
              {reading.sampleCount === 0
                ? "Nothing in the last few minutes."
                : `${reading.sampleCount} check${reading.sampleCount === 1 ? "" : "s"} in the window.`}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function arcPath(): string {
  const left = { x: CX - RADIUS, y: CY };
  const right = { x: CX + RADIUS, y: CY };
  return `M ${left.x} ${left.y} A ${RADIUS} ${RADIUS} 0 0 0 ${right.x} ${right.y}`;
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
    >
      <Radio className="size-3" aria-hidden />
      {label}
    </span>
  );
}
