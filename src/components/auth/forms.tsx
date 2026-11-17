"use client";

import { useActionState, useState, useTransition } from "react";
import {
  requestPasswordReset,
  sendMagicLink,
  setNewPassword,
  signIn,
  signUp,
  startTotpEnrolment,
  verifyMfa,
  type EnrolmentState,
  type FormState,
} from "@/app/(auth)/actions";
import { Field, FormMessage, SubmitButton } from "./ui";

const initial: FormState = {};

export function SignInForm({ next }: { next: string }) {
  const [state, action] = useActionState(signIn, initial);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormMessage error={state.error} />
      <input type="hidden" name="next" value={next} />
      <Field label="Email" name="email" type="email" autoComplete="email" inputMode="email" error={state.fields?.email} />
      <Field label="Password" name="password" type="password" autoComplete="current-password" error={state.fields?.password} />
      <SubmitButton>Sign in</SubmitButton>
    </form>
  );
}

export function MagicLinkForm({ next }: { next: string }) {
  const [state, action] = useActionState(sendMagicLink, initial);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormMessage error={state.error} />
      <input type="hidden" name="next" value={next} />
      <Field label="Email" name="email" type="email" autoComplete="email" inputMode="email" error={state.fields?.email} />
      <SubmitButton variant="secondary">Email me a sign-in link</SubmitButton>
    </form>
  );
}

export function SignUpForm({ next }: { next: string }) {
  const [state, action] = useActionState(signUp, initial);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormMessage error={state.error} />
      <input type="hidden" name="next" value={next} />
      <Field label="Email" name="email" type="email" autoComplete="email" inputMode="email" error={state.fields?.email} />
      <Field label="Password" name="password" type="password" autoComplete="new-password" hint="At least 12 characters." error={state.fields?.password} />
      <SubmitButton>Create account</SubmitButton>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action] = useActionState(requestPasswordReset, initial);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormMessage error={state.error} />
      <Field label="Email" name="email" type="email" autoComplete="email" inputMode="email" error={state.fields?.email} />
      <SubmitButton>Send reset link</SubmitButton>
    </form>
  );
}

export function NewPasswordForm() {
  const [state, action] = useActionState(setNewPassword, initial);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormMessage error={state.error} />
      <Field label="New password" name="password" type="password" autoComplete="new-password" hint="At least 12 characters." error={state.fields?.password} />
      <Field label="Confirm new password" name="confirm" type="password" autoComplete="new-password" error={state.fields?.confirm} />
      <SubmitButton>Save new password</SubmitButton>
    </form>
  );
}

export function MfaVerifyForm({ factorId, next, submitLabel = "Verify" }: { factorId: string; next: string; submitLabel?: string }) {
  const [state, action] = useActionState(verifyMfa, initial);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormMessage error={state.error ?? state.fields?.factorId} />
      <input type="hidden" name="factorId" value={factorId} />
      <input type="hidden" name="next" value={next} />
      <Field label="6-digit code" name="code" inputMode="numeric" autoComplete="one-time-code" error={state.fields?.code} />
      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}

export function TotpEnrolment() {
  const [enrolment, setEnrolment] = useState<EnrolmentState | null>(null);
  const [pending, start] = useTransition();
  if (!enrolment?.factorId) {
    return (
      <div className="flex flex-col gap-3">
        <FormMessage error={enrolment?.error} />
        <button
          type="button"
          disabled={pending}
          onClick={() => start(async () => setEnrolment(await startTotpEnrolment()))}
          className="min-h-11 self-start rounded-md bg-[var(--color-action)] px-4 font-medium text-[var(--color-on-action)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)]"
        >
          {pending ? "Working…" : "Set up an authenticator app"}
        </button>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <p>Scan this code with your authenticator app, or enter the key by hand. Then type the 6-digit code it shows.</p>
      {/* Supabase returns the QR code as an SVG data URL generated on the server. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={enrolment.qrCode} alt="QR code for your authenticator app" width={180} height={180} className="rounded-md bg-white p-2" />
      <p className="text-sm">
        Key: <code className="break-all font-mono">{enrolment.secret}</code>
      </p>
      <MfaVerifyForm factorId={enrolment.factorId} next="/account/security?updated=mfa" submitLabel="Turn on two-step sign-in" />
    </div>
  );
}
