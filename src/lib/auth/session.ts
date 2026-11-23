import "server-only";
import { redirect } from "next/navigation";
import { assuranceDecision } from "@/lib/auth/assurance";
import { currentUser, supabaseServer } from "@/lib/supabase/server";

/**
 * Requires a signed-in person who has completed multi-factor sign-in if they have it set up.
 * Used by every page and action that shows or changes account data, and before approving a
 * product's sign-in request (a password alone must not be enough once MFA is on).
 * Fails closed: if Supabase Auth can't say whether the second step is needed, nothing is shown or
 * approved (the error page appears instead of letting a password alone through).
 */
export async function requireUser(next: string) {
  const user = await currentUser();
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(next)}`);
  const supabase = await supabaseServer();
  const decision = assuranceDecision(await supabase.auth.mfa.getAuthenticatorAssuranceLevel());
  if (decision === "needs_mfa") redirect(`/sign-in/mfa?next=${encodeURIComponent(next)}`);
  if (decision === "unknown") throw new Error("The sign-in assurance level could not be checked. Please try again.");
  return user;
}
