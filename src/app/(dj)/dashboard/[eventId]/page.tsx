import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { EventStatus } from "@prisma/client";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EventQr } from "@/components/dj/event-qr";
import { EventStatusBadge } from "@/components/dj/event-status-badge";
import { LiveRequestBoard } from "@/components/dj/live-request-board";
import { RoomGauge } from "@/components/dj/room-gauge";
import { StartSessionButton } from "@/components/dj/start-session-button";
import { requireDjSession } from "@/lib/auth-dj";
import {
  EventServiceError,
  getEventForDj,
  publicEventPath,
  publicEventUrl,
} from "@/lib/services/events";
import { getCrowdReadingForDj } from "@/lib/services/crowd";
import { listSongRequestsForDj } from "@/lib/services/song-requests";

export default function EventDashboardPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-4">
          <div className="bg-muted h-8 w-64 animate-pulse rounded-lg" />
          <div className="bg-muted h-56 animate-pulse rounded-xl" />
        </div>
      }
    >
      <EventDashboardContent params={params} />
    </Suspense>
  );
}

async function EventDashboardContent({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { djProfile } = await requireDjSession();
  const { eventId } = await params;

  let event;
  try {
    event = await getEventForDj(eventId, djProfile.id);
  } catch (error) {
    if (error instanceof EventServiceError && error.code === "NOT_FOUND") {
      notFound();
    }
    if (error instanceof EventServiceError && error.code === "FORBIDDEN") {
      notFound();
    }
    throw error;
  }

  const initialRequests = await listSongRequestsForDj(event.id, djProfile.id);
  const initialReading = await getCrowdReadingForDj(event.id, djProfile.id);
  const smsNumber = process.env.TWILIO_PHONE_NUMBER?.trim() || null;
  const url = publicEventUrl(event);
  const path = publicEventPath(event);
  const canStart =
    event.status === EventStatus.DRAFT || event.status === EventStatus.PAUSED;
  const showJoinLink =
    event.status === EventStatus.LIVE ||
    event.status === EventStatus.PAUSED ||
    event.status === EventStatus.DRAFT;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/dashboard"
            className="text-muted-foreground text-sm hover:text-foreground"
          >
            ← Events
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">
              {event.name}
            </h1>
            <EventStatusBadge status={event.status} />
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            {event.venue.name}
            {event.venue.city ? ` · ${event.venue.city}` : ""}
            <span className="mx-1.5 text-white/20">·</span>
            {event.djProfile.stageName}
          </p>
        </div>
        {canStart ? <StartSessionButton eventId={event.id} /> : null}
      </div>

      {showJoinLink ? (
        <div className="grid gap-6 md:grid-cols-[auto_minmax(0,1fr)] md:items-start">
          <Card className="bg-surface ring-white/10">
            <CardHeader>
              <CardTitle>Audience QR</CardTitle>
              <CardDescription>
                Guests scan this to see the number and what to text.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center pb-6">
              <EventQr url={url} />
            </CardContent>
          </Card>

          <Card className="bg-surface ring-white/10">
            <CardHeader>
              <CardTitle>Public URL</CardTitle>
              <CardDescription>
                Share{" "}
                <code className="text-cyan">{path}</code>. The page is the text
                line for this night. Requests arrive by SMS while the event is
                live.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="break-all rounded-lg bg-background px-3 py-3 font-mono text-sm text-neon ring-1 ring-white/10 hover:ring-neon/40"
              >
                {url}
              </a>
              <div className="flex flex-wrap gap-2">
                <Button
                  nativeButton={false}
                  render={
                    <a href={url} target="_blank" rel="noreferrer" />
                  }
                  variant="outline"
                >
                  Open join page
                  <ExternalLink data-icon="inline-end" />
                </Button>
              </div>
              {event.status === EventStatus.DRAFT ? (
                <p className="text-muted-foreground text-sm">
                  Session is still a draft. Start it before texts are accepted.
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>
      ) : null}

      <RoomGauge
        key={event.id}
        eventId={event.id}
        initialReading={initialReading}
      />

      <section className="rounded-2xl bg-surface px-5 py-4 ring-1 ring-white/10">
        <h2 className="text-sm font-medium tracking-wide text-white/70 uppercase">
          Text line
        </h2>
        {smsNumber ? (
          <p className="mt-2 text-sm leading-relaxed">
            Guests can text{" "}
            <span className="font-mono text-cyan">{smsNumber}</span>. With one
            live session, texts land here. If several are live, they text{" "}
            <span className="font-mono text-neon">JOIN {event.slug}</span>.
          </p>
        ) : (
          <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
            Set <span className="font-mono">TWILIO_PHONE_NUMBER</span> and point
            the Messaging webhook at{" "}
            <span className="font-mono">/api/twilio/sms</span>. The room joins
            by text. This dashboard is where you watch it.
          </p>
        )}
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          HOT, COLD, or 1–5 for a direct check. A sentence is read for energy
          and sentiment. REQUEST Title - Artist adds a song.
        </p>
      </section>

      <LiveRequestBoard eventId={event.id} initialRequests={initialRequests} />
    </div>
  );
}
