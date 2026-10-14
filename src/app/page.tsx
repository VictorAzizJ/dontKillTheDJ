import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-6 py-16">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--neon)_0%,_transparent_46%),radial-gradient(ellipse_at_bottom_right,_var(--pink)_0%,_transparent_28%),radial-gradient(ellipse_at_bottom_left,_var(--cyan)_0%,_transparent_36%)] opacity-40"
      />
      <div className="relative z-10 flex max-w-lg flex-col items-center gap-6 text-center">
        <p className="text-sm font-medium tracking-[0.2em] text-cyan uppercase">
          Don&apos;t Kill the DJ
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
          Keep the floor moving. Don&apos;t kill the DJ.
        </h1>
        <p className="text-muted-foreground text-base leading-relaxed">
          Live song requests for nightlife events. Sign in as a DJ, go live, and
          share the QR with the room.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button nativeButton={false} render={<Link href="/login" />}>
            DJ login
          </Button>
          <Button
            nativeButton={false}
            variant="outline"
            render={<Link href="/dashboard" />}
          >
            Dashboard
          </Button>
        </div>
      </div>
    </main>
  );
}
