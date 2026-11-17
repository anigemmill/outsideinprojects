import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/auth/redirects";
import { supabaseServer } from "@/lib/supabase/server";

/*
  Where links in sign-up, magic-link and password-reset emails land (PKCE flow). Exchanges the
  one-time code for a session on the account domain, then continues to a same-site page.
*/
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"));
  if (code) {
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
    console.warn("[auth] code exchange failed", { code: error.code, status: error.status });
  }
  return NextResponse.redirect(new URL("/sign-in?error=link", url.origin));
}
