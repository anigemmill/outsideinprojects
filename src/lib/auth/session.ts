import "server-only";
import { redirect } from "next/navigation";
import { currentUser, supabaseServer } from "@/lib/supabase/server";

/**
 * Requires a signed-in person who has completed multi-factor sign-in if they have it set up.
 * Used by every page and action that shows or changes account data, and before approving a
 * product's sign-in request (a password alone must not be enough once MFA is on).
 */
export async function requireUser(next: string) {
  const user = await currentUser();
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(next)}`);
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (data && data.nextLevel === "aal2" && data.currentLevel !== "aal2") {
    redirect(`/sign-in/mfa?next=${encodeURIComponent(next)}`);
  }
  return user;
}
