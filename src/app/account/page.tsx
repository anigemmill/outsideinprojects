import type { Metadata } from "next";
import { signOut } from "@/app/(auth)/actions";
import { NotConfigured } from "@/components/auth/not-configured";
import { AuthShell, TextLink } from "@/components/auth/shell";
import { FormMessage, SubmitButton } from "@/components/auth/ui";
import { requireUser } from "@/lib/auth/session";
import { authConfigured } from "@/server/env";

export const metadata: Metadata = { title: "Your account · Outside In account" };

export default async function AccountPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (!authConfigured()) return <NotConfigured />;
  const user = await requireUser("/account");
  const updated = (await searchParams).updated;
  return (
    <AuthShell title="Your account">
      <FormMessage notice={updated === "password" ? "Your password has been changed." : undefined} />
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="text-[var(--color-text-muted)]">Email</dt>
        <dd className="break-all">{user.email}</dd>
        <dt className="text-[var(--color-text-muted)]">Two-step sign-in</dt>
        <dd>{user.aal === "aal2" ? "On, verified for this session" : <TextLink href="/account/security">Set up or manage</TextLink>}</dd>
      </dl>
      <p className="text-sm text-[var(--color-text-muted)]">
        Your organisations and products will appear here. They aren&apos;t built yet (plan step A3).
      </p>
      <form action={signOut} className="flex flex-wrap gap-3">
        <SubmitButton variant="secondary" name="scope" value="local">
          Sign out
        </SubmitButton>
        <SubmitButton variant="secondary" name="scope" value="global">
          Sign out everywhere
        </SubmitButton>
      </form>
    </AuthShell>
  );
}
