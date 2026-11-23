/*
  What the consent page does with an OAuth authorisation request from a product.

  Rules (security-review.md §2):
  - Every destination must be on the allow-list of product callback origins
    (PRODUCT_REDIRECT_ORIGINS). Supabase already checks the client's registered redirect URI; this is
    a second, independent check, so a misregistered client can't send a person's code elsewhere.
    An empty allow-list refuses everything (fail closed).
  - First-party products (FIRST_PARTY_CLIENT_IDS) are approved without a prompt, but only when their
    redirect is allowed. Auto-approval on page load is safe because each product binds `state` and
    the PKCE verifier to the browser that started sign-in: a code delivered to a browser that didn't
    start the request is refused by the product.
  - Any other client must be explicitly approved by the person.
*/
export type AuthorizationDetails =
  | { authorization_id: string; redirect_uri?: string; client: { id: string; name?: string; uri?: string }; scope?: string }
  | { redirect_url: string };

export type ConsentDecision =
  | { kind: "redirect"; url: string }
  | { kind: "auto-approve"; authorizationId: string }
  | { kind: "ask"; authorizationId: string; clientName: string; scopes: string[] }
  | { kind: "refuse" };

export function firstPartyClientIds(raw: string | undefined): Set<string> {
  return new Set((raw ?? "").split(",").map((s) => s.trim()).filter(Boolean));
}

/** Parses PRODUCT_REDIRECT_ORIGINS: comma-separated origins, https only except localhost. */
export function allowedRedirectOrigins(raw: string | undefined): Set<string> {
  const origins = new Set<string>();
  for (const part of (raw ?? "").split(",").map((s) => s.trim()).filter(Boolean)) {
    try {
      const u = new URL(part);
      const local = u.hostname === "localhost" || u.hostname === "127.0.0.1";
      if ((u.protocol === "https:" || (local && u.protocol === "http:")) && u.origin === part.replace(/\/$/, "")) origins.add(u.origin);
    } catch {
      // ignored: malformed entries never allow anything
    }
  }
  return origins;
}

/** True only for an absolute http(s) URL whose exact origin is on the allow-list. */
export function redirectAllowed(url: string | undefined | null, allowed: Set<string>): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    if (u.username || u.password) return false;
    return (u.protocol === "https:" || u.protocol === "http:") && allowed.has(u.origin);
  } catch {
    return false;
  }
}

export function decideConsent(details: AuthorizationDetails, firstParty: Set<string>, allowed: Set<string>): ConsentDecision {
  if ("redirect_url" in details) {
    return redirectAllowed(details.redirect_url, allowed) ? { kind: "redirect", url: details.redirect_url } : { kind: "refuse" };
  }
  if (!redirectAllowed(details.redirect_uri, allowed)) return { kind: "refuse" };
  if (details.client.id && firstParty.has(details.client.id)) return { kind: "auto-approve", authorizationId: details.authorization_id };
  return {
    kind: "ask",
    authorizationId: details.authorization_id,
    clientName: details.client.name?.trim() || "An application",
    scopes: (details.scope ?? "").split(/\s+/).filter(Boolean),
  };
}

const SCOPE_TEXT: Record<string, string> = {
  openid: "Confirm who you are",
  email: "See your email address",
  profile: "See your name and profile",
  phone: "See your phone number",
};

export function describeScope(scope: string): string {
  return SCOPE_TEXT[scope] ?? `Access: ${scope}`;
}
