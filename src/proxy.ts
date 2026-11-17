import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/*
  Keeps the Supabase Auth session fresh on every page request: if the access token has expired,
  the refresh token in the cookie is exchanged for a new one and the cookies are rewritten.
  It does not decide access; pages and actions check the user themselves (currentUser()).
*/
export async function proxy(request: NextRequest) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  let response = NextResponse.next({ request });
  if (!url || !key) return response; // sign-in not configured (e.g. CI build); pages show the setup message

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (items) => {
        for (const { name, value } of items) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of items) {
          response.cookies.set(name, value, { ...options, httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
        }
      },
    },
  });
  // Validates the token and refreshes the session when needed. Must run before the response is returned.
  await supabase.auth.getClaims();
  return response;
}

export const config = {
  // Everything except static files, images and the health check.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/health|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
