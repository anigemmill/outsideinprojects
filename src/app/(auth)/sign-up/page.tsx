import type { Metadata } from "next";
import { SignUpForm } from "@/components/auth/forms";
import { NotConfigured } from "@/components/auth/not-configured";
import { AuthShell, TextLink } from "@/components/auth/shell";
import { safeNext } from "@/lib/auth/redirects";
import { authConfigured } from "@/server/env";

export const metadata: Metadata = { title: "Create an account · Outside In account" };

export default async function SignUpPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (!authConfigured()) return <NotConfigured />;
  const next = safeNext((await searchParams).next);
  return (
    <AuthShell title="Create your account" footer={<TextLink href={`/sign-in?next=${encodeURIComponent(next)}`}>Already have an account? Sign in</TextLink>}>
      <p className="text-sm text-[var(--color-text-muted)]">
        One account works across Command Centre, Findable and Reel Deal. We&apos;ll email you a link to confirm your address.
      </p>
      <SignUpForm next={next} />
    </AuthShell>
  );
}
