import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MfaVerifyForm } from "@/components/auth/forms";
import { NotConfigured } from "@/components/auth/not-configured";
import { AuthShell, TextLink } from "@/components/auth/shell";
import { safeNext } from "@/lib/auth/redirects";
import { currentUser, supabaseServer } from "@/lib/supabase/server";
import { authConfigured } from "@/server/env";

export const metadata: Metadata = { title: "Two-step sign-in · Outside In account" };

export default async function MfaChallengePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (!authConfigured()) return <NotConfigured />;
  const next = safeNext((await searchParams).next);
  if (!(await currentUser())) redirect(`/sign-in?next=${encodeURIComponent(next)}`);
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.mfa.listFactors();
  const factor = data?.totp.find((f) => f.status === "verified");
  if (!factor) redirect(next); // nothing to verify
  return (
    <AuthShell title="Two-step sign-in" footer={<TextLink href="/sign-in">Use a different account</TextLink>}>
      <p className="text-sm text-[var(--color-text-muted)]">Open your authenticator app and enter the 6-digit code for your Outside In account.</p>
      <MfaVerifyForm factorId={factor.id} next={next} />
    </AuthShell>
  );
}
