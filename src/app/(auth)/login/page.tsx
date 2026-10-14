import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LoginForm } from "./login-form";

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  return (
    <main className="relative flex flex-1 flex-col items-center justify-center px-4 py-16">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--neon)_0%,_transparent_48%),radial-gradient(ellipse_at_bottom_left,_var(--cyan)_0%,_transparent_40%)] opacity-35"
      />
      <div className="relative z-10 w-full max-w-md">
        <p className="mb-6 text-center text-sm font-medium tracking-[0.2em] text-cyan uppercase">
          Don&apos;t Kill the DJ
        </p>
        <Suspense fallback={<LoginCardFallback />}>
          <LoginGate searchParams={searchParams} />
        </Suspense>
        <p className="text-muted-foreground mt-6 text-center text-sm">
          <Link href="/" className="text-neon hover:underline">
            Back home
          </Link>
        </p>
      </div>
    </main>
  );
}

async function LoginGate({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  await connection();
  const session = await auth();
  if (session?.user) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const error =
    typeof params.error === "string" ? params.error : undefined;

  return (
    <Card className="bg-surface/90 ring-white/10 backdrop-blur">
      <CardHeader>
        <CardTitle className="text-xl">DJ sign in</CardTitle>
        <CardDescription>
          Manage live events and share your request link with the room.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {error === "NotADj" ? (
          <p className="text-sm text-destructive" role="alert">
            This account has no DJ profile.
          </p>
        ) : null}
        <LoginForm />
        <p className="text-muted-foreground text-center text-xs">
          Demo:{" "}
          <span className="text-foreground">dj@neonroom.local</span> /{" "}
          <span className="text-foreground">crowdcontrol</span>
        </p>
      </CardContent>
    </Card>
  );
}

function LoginCardFallback() {
  return (
    <Card className="bg-surface/90 ring-white/10 backdrop-blur">
      <CardHeader>
        <CardTitle className="text-xl">DJ sign in</CardTitle>
        <CardDescription>Loading…</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="bg-muted h-40 animate-pulse rounded-lg" />
      </CardContent>
    </Card>
  );
}
