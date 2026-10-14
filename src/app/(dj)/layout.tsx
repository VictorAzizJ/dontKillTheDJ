import Link from "next/link";
import { Suspense } from "react";
import { signOut } from "@/auth";
import { Button } from "@/components/ui/button";
import { requireDjSession } from "@/lib/auth-dj";

/**
 * Auth chrome streams behind Suspense; {children} stay outside so the static
 * shell can render instantly (Cache Components). Pages still call
 * requireDjSession() for their own data.
 */
export default function DjLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <Suspense fallback={<DjHeaderFallback />}>
        <DjHeader />
      </Suspense>
      <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</div>
    </div>
  );
}

async function DjHeader() {
  const { session, djProfile } = await requireDjSession();

  return (
    <header className="border-b border-white/10 bg-surface/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="text-sm font-medium tracking-[0.18em] text-cyan uppercase"
          >
            Don&apos;t Kill the DJ
          </Link>
          <span className="text-muted-foreground hidden text-sm sm:inline">
            {djProfile.stageName}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground hidden text-xs sm:inline">
            {session.user.email}
          </span>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <Button type="submit" variant="ghost" size="sm">
              Sign out
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}

function DjHeaderFallback() {
  return (
    <header className="border-b border-white/10 bg-surface/80">
      <div className="mx-auto flex w-full max-w-5xl items-center px-4 py-3">
        <span className="text-sm font-medium tracking-[0.18em] text-cyan uppercase">
          Don&apos;t Kill the DJ
        </span>
      </div>
    </header>
  );
}
