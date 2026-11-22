/*
  Whether a signed-in person may continue, given Supabase Auth's assurance-level answer.
  Fails closed: if the level can't be determined, the person does not get through on a password
  alone. Used by requireUser() before account pages and before approving a product's sign-in.
*/
export type AssuranceAnswer = {
  data: { currentLevel: string | null; nextLevel: string | null } | null;
  error: unknown;
};

export type AssuranceDecision = "continue" | "needs_mfa" | "unknown";

export function assuranceDecision(answer: AssuranceAnswer): AssuranceDecision {
  if (answer.error || !answer.data) return "unknown";
  const { currentLevel, nextLevel } = answer.data;
  if (nextLevel === "aal2" && currentLevel !== "aal2") return "needs_mfa";
  if (currentLevel !== "aal1" && currentLevel !== "aal2") return "unknown";
  return "continue";
}
