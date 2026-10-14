"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";

export function StartSessionButton({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        size="lg"
        className="h-11"
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const res = await fetch(`/api/events/${eventId}/start`, {
              method: "POST",
            });
            const data = (await res.json().catch(() => ({}))) as {
              error?: string;
            };
            if (!res.ok) {
              setError(data.error ?? "Could not start session.");
              return;
            }
            router.refresh();
          });
        }}
      >
        {pending ? "Starting…" : "Start session"}
      </Button>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
