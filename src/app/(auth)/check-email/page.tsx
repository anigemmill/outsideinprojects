import type { Metadata } from "next";
import { AuthShell, TextLink } from "@/components/auth/shell";
import { MESSAGES } from "@/lib/auth/messages";

export const metadata: Metadata = { title: "Check your email · Outside In account" };

export default function CheckEmailPage() {
  return (
    <AuthShell title="Check your email" footer={<TextLink href="/sign-in">Back to sign in</TextLink>}>
      <p role="status">{MESSAGES.checkEmail}</p>
      <p className="text-sm text-[var(--color-text-muted)]">The link works once and expires after an hour.</p>
    </AuthShell>
  );
}
