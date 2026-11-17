import type { Metadata } from "next";
import { removeFactor } from "@/app/(auth)/actions";
import { TotpEnrolment } from "@/components/auth/forms";
import { NotConfigured } from "@/components/auth/not-configured";
import { AuthShell, TextLink } from "@/components/auth/shell";
import { FormMessage, SubmitButton } from "@/components/auth/ui";
import { requireUser } from "@/lib/auth/session";
import { supabaseServer } from "@/lib/supabase/server";
import { authConfigured } from "@/server/env";

export const metadata: Metadata = { title: "Security · Outside In account" };

export default async function SecurityPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (!authConfigured()) return <NotConfigured />;
  await requireUser("/account/security");
  const updated = (await searchParams).updated;
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.mfa.listFactors();
  const verified = data?.totp.filter((f) => f.status === "verified") ?? [];
  return (
    <AuthShell title="Two-step sign-in" footer={<TextLink href="/account">Back to your account</TextLink>}>
      <FormMessage notice={updated === "mfa" ? "Two-step sign-in is on. You'll be asked for a code when you sign in." : undefined} />
      {verified.length > 0 ? (
        <>
          <p>Two-step sign-in is on with {verified.length === 1 ? "an authenticator app" : `${verified.length} authenticator apps`}.</p>
          <ul className="flex flex-col gap-3">
            {verified.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-3 text-sm">
                <span>{f.friendly_name ?? "Authenticator app"}</span>
                <form action={removeFactor}>
                  <input type="hidden" name="factorId" value={f.id} />
                  <SubmitButton variant="secondary">Remove</SubmitButton>
                </form>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <>
          <p>Add a second step to signing in: a 6-digit code from an authenticator app on your phone.</p>
          <TotpEnrolment />
        </>
      )}
    </AuthShell>
  );
}
