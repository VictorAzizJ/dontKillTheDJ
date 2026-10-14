"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type VenueOption = {
  id: string;
  name: string;
};

export function CreateEventForm({ venues }: { venues: VenueOption[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        const form = new FormData(event.currentTarget);
        const name = String(form.get("name") ?? "").trim();
        const venueId = String(form.get("venueId") ?? "");

        startTransition(async () => {
          const res = await fetch("/api/events", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, venueId }),
          });
          const data = (await res.json().catch(() => ({}))) as {
            error?: string;
            event?: { id: string };
          };
          if (!res.ok || !data.event) {
            setError(data.error ?? "Could not create event.");
            return;
          }
          router.push(`/dashboard/${data.event.id}`);
          router.refresh();
        });
      }}
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Event name</Label>
        <Input
          id="name"
          name="name"
          required
          minLength={2}
          maxLength={120}
          placeholder="Friday Night Live"
          className="h-11 bg-background"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="venueId">Venue</Label>
        <select
          id="venueId"
          name="venueId"
          required
          defaultValue={venues[0]?.id}
          className="border-input h-11 w-full rounded-lg border bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {venues.map((venue) => (
            <option key={venue.id} value={venue.id}>
              {venue.name}
            </option>
          ))}
        </select>
      </div>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <Button type="submit" size="lg" className="h-11" disabled={pending || venues.length === 0}>
        {pending ? "Creating…" : "Create event"}
      </Button>
    </form>
  );
}
