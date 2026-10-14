import Link from "next/link";
import { Suspense } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CreateEventForm } from "@/components/dj/create-event-form";
import { EventStatusBadge } from "@/components/dj/event-status-badge";
import { requireDjSession } from "@/lib/auth-dj";
import {
  listEventsForDj,
  listVenues,
  publicEventPath,
} from "@/lib/services/events";

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-4">
          <div className="bg-muted h-8 w-48 animate-pulse rounded-lg" />
          <div className="bg-muted h-40 animate-pulse rounded-xl" />
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}

async function DashboardContent() {
  const { djProfile } = await requireDjSession();
  const [events, venues] = await Promise.all([
    listEventsForDj(djProfile.id),
    listVenues(),
  ]);

  return (
    <div className="flex flex-col gap-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Events</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Create a night, go live, and share the audience link.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
            Your nights
          </h2>
          {events.length === 0 ? (
            <p className="text-muted-foreground rounded-xl bg-surface p-6 text-sm ring-1 ring-white/10">
              No events yet. Create one to get a public request link.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {events.map((event) => (
                <li key={event.id}>
                  <Link
                    href={`/dashboard/${event.id}`}
                    className="block rounded-xl bg-surface p-4 ring-1 ring-white/10 transition hover:ring-neon/40"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{event.name}</p>
                        <p className="text-muted-foreground mt-1 text-sm">
                          {event.venue.name}
                          <span className="mx-1.5 text-white/20">·</span>
                          {publicEventPath(event)}
                        </p>
                      </div>
                      <EventStatusBadge status={event.status} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <Card className="h-fit bg-surface ring-white/10">
          <CardHeader>
            <CardTitle>New event</CardTitle>
            <CardDescription>
              Name the night and pick a venue. Start the session when you&apos;re
              ready for requests.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {venues.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No venues seeded yet. Run{" "}
                <code className="text-cyan">npm run db:seed</code>.
              </p>
            ) : (
              <CreateEventForm venues={venues} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
