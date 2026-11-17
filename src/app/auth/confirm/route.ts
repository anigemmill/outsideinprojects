import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/auth/redirects";
import { supabaseServer } from "@/lib/supabase/server";

/*
  The alternative landing page for email links that carry a token hash (Supabase's recommended
  server-side email template: {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=...).
  Works across devices, unlike the PKCE code, which needs the browser that started the request.
*/
const TYPES = new Set<EmailOtpType>(["signup", "invite", "magiclink", "recovery", "email_change", "email"]);

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const next = type === "recovery" ? "/reset-password" : safeNext(url.searchParams.get("next"));
  if (tokenHash && type && TYPES.has(type)) {
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
    console.warn("[auth] email link verification failed", { code: error.code, status: error.status });
  }
  return NextResponse.redirect(new URL("/sign-in?error=link", url.origin));
}
