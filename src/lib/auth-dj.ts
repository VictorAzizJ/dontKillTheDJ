import { redirect } from "next/navigation";
import { connection } from "next/server";
import { auth } from "@/auth";
import { getDjProfileForUser } from "@/lib/services/events";

/** Require a signed-in DJ. Redirects to login when missing. */
export async function requireDjSession() {
  await connection();
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const djProfile = await getDjProfileForUser(session.user.id);
  if (!djProfile) {
    redirect("/login?error=NotADj");
  }

  return { session, djProfile };
}
