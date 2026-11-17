/*
  What the consent page does with an OAuth authorisation request from a product.
  First-party products (Command Centre, Findable, Reel Deal) are approved without a prompt: they are
  the same service to the customer. Any other client must be explicitly approved by the person.
*/
export type AuthorizationDetails =
  | { authorization_id: string; client: { id: string; name?: string; uri?: string }; scope?: string }
  | { redirect_url: string };

export type ConsentDecision =
  | { kind: "redirect"; url: string }
  | { kind: "auto-approve"; authorizationId: string }
  | { kind: "ask"; authorizationId: string; clientName: string; scopes: string[] };

export function firstPartyClientIds(raw: string | undefined): Set<string> {
  return new Set((raw ?? "").split(",").map((s) => s.trim()).filter(Boolean));
}

export function decideConsent(details: AuthorizationDetails, firstParty: Set<string>): ConsentDecision {
  if ("redirect_url" in details) return { kind: "redirect", url: details.redirect_url };
  if (firstParty.has(details.client.id)) return { kind: "auto-approve", authorizationId: details.authorization_id };
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
