import type { Metadata } from "next";
import { NewPasswordForm } from "@/components/auth/forms";
import { NotConfigured } from "@/components/auth/not-configured";
import { AuthShell } from "@/components/auth/shell";
import { requireUser } from "@/lib/auth/session";
import { authConfigured } from "@/server/env";

export const metadata: Metadata = { title: "Choose a new password · Outside In account" };

export default async function ResetPasswordPage() {
  if (!authConfigured()) return <NotConfigured />;
  // The reset email's link signs the person in (via /auth/callback) and brings them here.
  await requireUser("/reset-password");
  return (
    <AuthShell title="Choose a new password">
      <NewPasswordForm />
    </AuthShell>
  );
}
