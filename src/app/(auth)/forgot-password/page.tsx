import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth/forms";
import { NotConfigured } from "@/components/auth/not-configured";
import { AuthShell, TextLink } from "@/components/auth/shell";
import { authConfigured } from "@/server/env";

export const metadata: Metadata = { title: "Reset your password · Outside In account" };

export default function ForgotPasswordPage() {
  if (!authConfigured()) return <NotConfigured />;
  return (
    <AuthShell title="Reset your password" footer={<TextLink href="/sign-in">Back to sign in</TextLink>}>
      <p className="text-sm text-[var(--color-text-muted)]">Enter your email address and we&apos;ll send you a link to choose a new password.</p>
      <ForgotPasswordForm />
    </AuthShell>
  );
}
