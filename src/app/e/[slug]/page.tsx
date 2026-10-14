import { Suspense } from "react";
import { notFound } from "next/navigation";
import { EventStatus } from "@prisma/client";
import { TextLine } from "@/components/audience/text-line";
import { EventStatusBadge } from "@/components/dj/event-status-badge";
import { getPublicEventBySlug } from "@/lib/services/events";

export default function PublicEventPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return (
    <Suspense fallback={<PublicEventFallback />}>
      <PublicEventContent params={params} />
    </Suspense>
  );
}

async function PublicEventContent({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const event = await getPublicEventBySlug(slug);
  if (!event) {
    notFound();
  }

  const isLive = event.status === EventStatus.LIVE;
  const venueLine = [event.venue.name, event.venue.city]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="relative flex min-h-full flex-1 flex-col">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--neon)_0%,_transparent_48%),radial-gradient(ellipse_at_bottom_left,_var(--cyan)_0%,_transparent_40%)] opacity-35"
      />

      <main className="relative z-10 mx-auto flex w-full max-w-lg flex-1 flex-col px-4 pt-8 pb-10">
        <p className="text-xs font-medium tracking-[0.2em] text-cyan uppercase">
          CrowdControl
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">{event.name}</h1>
          <EventStatusBadge status={event.status} className="text-[11px]" />
        </div>

        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          {venueLine}
          <span className="mx-1.5 text-white/20">·</span>
          {event.djProfile.stageName}
        </p>

        <TextLine
          isLive={isLive}
          phone={process.env.TWILIO_PHONE_NUMBER?.trim() || null}
          slug={event.slug}
        />
      </main>
    </div>
  );
}

function PublicEventFallback() {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 px-4 pt-8 pb-28">
      <div className="bg-muted h-3 w-28 animate-pulse rounded" />
      <div className="bg-muted h-9 w-56 animate-pulse rounded-lg" />
      <div className="bg-muted h-4 w-40 animate-pulse rounded" />
      <div className="bg-muted mt-6 h-56 animate-pulse rounded-xl" />
    </div>
  );
}
