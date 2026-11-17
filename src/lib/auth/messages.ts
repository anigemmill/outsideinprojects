/*
  Messages shown for Supabase Auth errors. Sign-in and recovery never reveal whether an email
  address has an account (no account enumeration); the details go to the server log only.
*/
type AuthErrorLike = { code?: string; status?: number; message?: string; name?: string } | null | undefined;

export const MESSAGES = {
  signInFailed: "That email and password don't match an account, or the email hasn't been confirmed yet.",
  checkEmail: "If that address can be used, we've sent an email. Check your inbox (and spam folder).",
  rateLimited: "Too many attempts. Please wait a few minutes and try again.",
  weakPassword: "Choose a stronger password: at least 12 characters, not a common or leaked password.",
  linkInvalid: "That link has expired or was already used. Request a new one.",
  mfaInvalid: "That code didn't work. Check the time on your device and try the newest code.",
  unavailable: "Sign-in is temporarily unavailable. Please try again in a few minutes.",
  generic: "Something went wrong. Please try again.",
} as const;

export function messageFor(error: AuthErrorLike, context: "sign-in" | "sign-up" | "email" | "password" | "mfa"): string {
  const code = error?.code ?? "";
  // The Auth server couldn't be reached or failed: say so, rather than blaming the person's password.
  if (error?.name === "AuthRetryableFetchError" || error?.status === 0 || (error?.status ?? 0) >= 500) return MESSAGES.unavailable;
  if (error?.status === 429 || code.includes("rate_limit")) return MESSAGES.rateLimited;
  if (code === "weak_password") return MESSAGES.weakPassword;
  switch (context) {
    case "sign-in":
      return MESSAGES.signInFailed;
    case "sign-up":
    case "email":
      // Same answer whether or not the address already has an account.
      return MESSAGES.checkEmail;
    case "mfa":
      return MESSAGES.mfaInvalid;
    default:
      return MESSAGES.generic;
  }
}
