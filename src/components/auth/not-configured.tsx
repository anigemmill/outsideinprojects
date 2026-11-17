import { AuthShell } from "./shell";

/** Shown instead of a sign-in form when no Supabase Auth project is configured (honest, not faked). */
export function NotConfigured() {
  return (
    <AuthShell title="Sign-in isn't set up here yet">
      <p>
        This copy of the account service isn&apos;t connected to a Supabase Auth project, so nobody can sign in. A developer sets{" "}
        <code className="font-mono">SUPABASE_URL</code> and <code className="font-mono">SUPABASE_PUBLISHABLE_KEY</code> (see{" "}
        <code className="font-mono">docs/development.md</code>).
      </p>
    </AuthShell>
  );
}
