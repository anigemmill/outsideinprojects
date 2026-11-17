import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { authConfig } from "@/server/env";

/*
  Supabase Auth client for server components, server actions and route handlers. The session lives
  in httpOnly cookies on the account domain only; products never see these cookies, they get their
  own tokens through the OAuth flow (docs/identity-architecture.md).
*/
export async function supabaseServer() {
  const { url, publishableKey } = authConfig();
  const store = await cookies();
  return createServerClient(url, publishableKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (items) => {
        try {
          for (const { name, value, options } of items) store.set(name, value, { ...options, httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
        } catch {
          // Server components can't set cookies; src/proxy.ts refreshes the session instead.
        }
      },
    },
  });
}

/**
 * The signed-in person, verified: getClaims() checks the access token's signature and expiry
 * against the project's signing keys, rather than trusting what is stored in the cookie.
 */
export async function currentUser() {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  return { id: data.claims.sub as string, email: (data.claims.email as string | undefined) ?? "", aal: (data.claims.aal as string | undefined) ?? "aal1" };
}
