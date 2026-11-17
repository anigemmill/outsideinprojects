import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { NotConfigured } from "@/components/auth/not-configured";
import { AuthShell } from "@/components/auth/shell";
import { FormMessage, SubmitButton } from "@/components/auth/ui";
import { decideConsent, describeScope, firstPartyClientIds, type AuthorizationDetails } from "@/lib/auth/consent";
import { requireUser } from "@/lib/auth/session";
import { supabaseServer } from "@/lib/supabase/server";
import { authConfigured, env } from "@/server/env";
import { answerConsent } from "./actions";

export const metadata: Metadata = { title: "Continue to an application · Outside In account" };

/*
  Supabase Auth's OAuth 2.1 server sends people here (GOTRUE_OAUTH_SERVER_AUTHORIZATION_PATH) when a
  product asks to sign them in. First-party products are approved straight away; any other client
  needs the person's explicit approval. See docs/identity-architecture.md §2.
*/
export default async function ConsentPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (!authConfigured()) return <NotConfigured />;
  const authorizationId = (await searchParams).authorization_id ?? "";
  if (!/^[A-Za-z0-9_-]{1,200}$/.test(authorizationId)) {
    return (
      <AuthShell title="This sign-in request isn't valid">
        <FormMessage error="Go back to the application and try signing in again." />
      </AuthShell>
    );
  }
  await requireUser(`/oauth/consent?authorization_id=${authorizationId}`);

  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId);
  if (error || !data) {
    return (
      <AuthShell title="This sign-in request has expired">
        <FormMessage error="Go back to the application and try signing in again." />
      </AuthShell>
    );
  }
  const decision = decideConsent(data as AuthorizationDetails, firstPartyClientIds(env().FIRST_PARTY_CLIENT_IDS));
  if (decision.kind === "redirect") redirect(decision.url);
  if (decision.kind === "auto-approve") {
    const approved = await supabase.auth.oauth.approveAuthorization(decision.authorizationId, { skipBrowserRedirect: true });
    if (approved.error || !approved.data?.redirect_url) {
      return (
        <AuthShell title="We couldn't finish signing you in">
          <FormMessage error="Go back to the application and try again." />
        </AuthShell>
      );
    }
    redirect(approved.data.redirect_url);
  }

  return (
    <AuthShell title={`Continue to ${decision.clientName}?`}>
      <p>
        <strong>{decision.clientName}</strong> wants to use your Outside In account to sign you in. It will be able to:
      </p>
      <ul className="list-disc pl-5 text-sm">
        {(decision.scopes.length ? decision.scopes : ["openid"]).map((s) => (
          <li key={s}>{describeScope(s)}</li>
        ))}
      </ul>
      <p className="text-sm text-[var(--color-text-muted)]">It won&apos;t see your password. You can remove its access at any time.</p>
      <form action={answerConsent} className="flex flex-wrap gap-3">
        <input type="hidden" name="authorization_id" value={decision.authorizationId} />
        <SubmitButton name="decision" value="approve">
          Allow
        </SubmitButton>
        <SubmitButton name="decision" value="deny" variant="secondary">
          Deny
        </SubmitButton>
      </form>
    </AuthShell>
  );
}
