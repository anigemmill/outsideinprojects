import type { Metadata } from "next";
import { MagicLinkForm, SignInForm } from "@/components/auth/forms";
import { NotConfigured } from "@/components/auth/not-configured";
import { AuthShell, TextLink } from "@/components/auth/shell";
import { FormMessage } from "@/components/auth/ui";
import { safeNext } from "@/lib/auth/redirects";
import { authConfigured } from "@/server/env";

export const metadata: Metadata = { title: "Sign in · Outside In account" };

export default async function SignInPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (!authConfigured()) return <NotConfigured />;
  const params = await searchParams;
  const next = safeNext(params.next);
  const notice = params.signed_out === "everywhere" ? "You've been signed out on every device." : params.signed_out ? "You've been signed out." : undefined;
  return (
    <AuthShell
      title="Sign in"
      footer={
        <>
          <TextLink href={`/sign-up?next=${encodeURIComponent(next)}`}>Create an account</TextLink>
          <TextLink href="/forgot-password">Forgot your password?</TextLink>
        </>
      }
    >
      <FormMessage notice={notice} error={params.error === "link" ? "That link has expired or was already used. Request a new one." : undefined} />
      <p className="text-sm text-[var(--color-text-muted)]">One account for Command Centre, Findable and Reel Deal.</p>
      <SignInForm next={next} />
      <div className="flex items-center gap-3 text-sm text-[var(--color-text-muted)]" aria-hidden="true">
        <span className="h-px flex-1 bg-[var(--color-border)]" /> or <span className="h-px flex-1 bg-[var(--color-border)]" />
      </div>
      <MagicLinkForm next={next} />
    </AuthShell>
  );
}
