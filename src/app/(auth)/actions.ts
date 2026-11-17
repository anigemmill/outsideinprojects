"use server";

import { redirect } from "next/navigation";
import { messageFor } from "@/lib/auth/messages";
import { safeNext } from "@/lib/auth/redirects";
import { EmailOnlyInput, NewPasswordInput, parseForm, SignInInput, SignUpInput, TotpCodeInput, type FieldErrors } from "@/lib/auth/schemas";
import { requireUser } from "@/lib/auth/session";
import { supabaseServer } from "@/lib/supabase/server";
import { env } from "@/server/env";

export type FormState = { error?: string; fields?: FieldErrors };

const nextFrom = (form: FormData) => safeNext(String(form.get("next") ?? ""));
const callbackUrl = (next: string) => `${env().APP_URL}/auth/callback?next=${encodeURIComponent(next)}`;

function logAuthError(where: string, error: { code?: string; status?: number } | null) {
  // Codes only: never the email address or the password.
  if (error) console.warn(`[auth] ${where} failed`, { code: error.code, status: error.status });
}

export async function signIn(_: FormState, form: FormData): Promise<FormState> {
  const parsed = parseForm(SignInInput, form);
  if (!parsed.ok) return { fields: parsed.errors };
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    logAuthError("sign-in", error);
    return { error: messageFor(error, "sign-in") };
  }
  const next = nextFrom(form);
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (data?.nextLevel === "aal2" && data.currentLevel !== "aal2") redirect(`/sign-in/mfa?next=${encodeURIComponent(next)}`);
  redirect(next);
}

export async function signUp(_: FormState, form: FormData): Promise<FormState> {
  const parsed = parseForm(SignUpInput, form);
  if (!parsed.ok) return { fields: parsed.errors };
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signUp({ ...parsed.data, options: { emailRedirectTo: callbackUrl(nextFrom(form)) } });
  if (error && (error.code === "weak_password" || error.status === 429 || error.status === 0 || (error.status ?? 0) >= 500)) return { error: messageFor(error, "sign-up") };
  logAuthError("sign-up", error);
  redirect("/check-email"); // same outcome whether or not the address already has an account
}

export async function sendMagicLink(_: FormState, form: FormData): Promise<FormState> {
  const parsed = parseForm(EmailOnlyInput, form);
  if (!parsed.ok) return { fields: parsed.errors };
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithOtp({ email: parsed.data.email, options: { shouldCreateUser: false, emailRedirectTo: callbackUrl(nextFrom(form)) } });
  if (error && (error.status === 429 || error.status === 0 || (error.status ?? 0) >= 500)) return { error: messageFor(error, "email") };
  logAuthError("magic-link", error);
  redirect("/check-email");
}

export async function requestPasswordReset(_: FormState, form: FormData): Promise<FormState> {
  const parsed = parseForm(EmailOnlyInput, form);
  if (!parsed.ok) return { fields: parsed.errors };
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, { redirectTo: callbackUrl("/reset-password") });
  if (error && (error.status === 429 || error.status === 0 || (error.status ?? 0) >= 500)) return { error: messageFor(error, "email") };
  logAuthError("password-reset", error);
  redirect("/check-email");
}

export async function setNewPassword(_: FormState, form: FormData): Promise<FormState> {
  const parsed = parseForm(NewPasswordInput, form);
  if (!parsed.ok) return { fields: parsed.errors };
  await requireUser("/reset-password"); // the reset link signs the person in for this step
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    logAuthError("set-password", error);
    return { error: messageFor(error, "password") };
  }
  redirect("/account?updated=password");
}

export async function verifyMfa(_: FormState, form: FormData): Promise<FormState> {
  const parsed = parseForm(TotpCodeInput, form);
  if (!parsed.ok) return { fields: parsed.errors };
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.mfa.challengeAndVerify(parsed.data);
  if (error) {
    logAuthError("mfa-verify", error);
    return { error: messageFor(error, "mfa") };
  }
  redirect(nextFrom(form));
}

export type EnrolmentState = FormState & { factorId?: string; qrCode?: string; secret?: string };

export async function startTotpEnrolment(): Promise<EnrolmentState> {
  await requireUser("/account/security");
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `Authenticator ${new Date().toISOString().slice(0, 10)}` });
  if (error || !data) {
    logAuthError("mfa-enrol", error);
    return { error: messageFor(error, "mfa") };
  }
  return { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret };
}

export async function removeFactor(form: FormData): Promise<void> {
  await requireUser("/account/security"); // removing a factor needs a full (aal2) session
  const factorId = String(form.get("factorId") ?? "");
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  logAuthError("mfa-remove", error);
  redirect("/account/security");
}

export async function signOut(form: FormData): Promise<void> {
  const everywhere = form.get("scope") === "global";
  const supabase = await supabaseServer();
  // "global" ends every session for this person: all browsers and devices.
  const { error } = await supabase.auth.signOut({ scope: everywhere ? "global" : "local" });
  logAuthError("sign-out", error);
  redirect(everywhere ? "/sign-in?signed_out=everywhere" : "/sign-in?signed_out=1");
}
