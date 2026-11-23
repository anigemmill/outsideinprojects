import { describe, expect, it } from "vitest";
import { allowedRedirectOrigins, decideConsent, describeScope, firstPartyClientIds, redirectAllowed } from "./consent";

const firstParty = firstPartyClientIds(" cc-client , findable-client,,");
const allowed = allowedRedirectOrigins("http://localhost:3000, https://commandcentre.theoutsidein.nz");
const CB = "https://commandcentre.theoutsidein.nz/auth/callback";

describe("allowedRedirectOrigins", () => {
  it("keeps exact https origins and localhost http, drops everything else", () => {
    expect([...allowedRedirectOrigins("https://a.example, http://localhost:3000, http://evil.example, https://b.example/path, nonsense,")]).toEqual([
      "https://a.example",
      "http://localhost:3000",
    ]);
    expect(allowedRedirectOrigins(undefined).size).toBe(0);
  });
});

describe("redirectAllowed", () => {
  it("allows only an exact allowed origin", () => {
    expect(redirectAllowed(`${CB}?code=1&state=s`, allowed)).toBe(true);
    expect(redirectAllowed("https://commandcentre.theoutsidein.nz.evil.example/auth/callback", allowed)).toBe(false);
    expect(redirectAllowed("https://evil.example/auth/callback", allowed)).toBe(false);
    expect(redirectAllowed("https://user:pw@commandcentre.theoutsidein.nz/auth/callback", allowed)).toBe(false);
    expect(redirectAllowed("javascript:alert(1)", allowed)).toBe(false);
    expect(redirectAllowed("/relative", allowed)).toBe(false);
    expect(redirectAllowed(undefined, allowed)).toBe(false);
  });
});

describe("decideConsent", () => {
  it("follows an allowed redirect when consent was already given", () => {
    expect(decideConsent({ redirect_url: `${CB}?code=1` }, firstParty, allowed)).toEqual({ kind: "redirect", url: `${CB}?code=1` });
  });

  it("refuses a redirect to an origin that isn't allowed", () => {
    expect(decideConsent({ redirect_url: "https://evil.example/cb?code=1" }, firstParty, allowed)).toEqual({ kind: "refuse" });
    expect(decideConsent({ authorization_id: "a0", redirect_uri: "https://evil.example/cb", client: { id: "cc-client" } }, firstParty, allowed)).toEqual({
      kind: "refuse",
    });
  });

  it("refuses everything when no origins are configured (fail closed)", () => {
    expect(decideConsent({ authorization_id: "a1", redirect_uri: CB, client: { id: "cc-client" } }, firstParty, new Set()).kind).toBe("refuse");
    expect(decideConsent({ authorization_id: "a1", client: { id: "cc-client" } }, firstParty, allowed).kind).toBe("refuse");
  });

  it("auto-approves first-party products with an allowed redirect", () => {
    expect(decideConsent({ authorization_id: "a1", redirect_uri: CB, client: { id: "cc-client" } }, firstParty, allowed)).toEqual({
      kind: "auto-approve",
      authorizationId: "a1",
    });
  });

  it("asks the person for any other client with an allowed redirect", () => {
    expect(
      decideConsent({ authorization_id: "a2", redirect_uri: CB, client: { id: "other", name: "Partner tool" }, scope: "openid  email" }, firstParty, allowed),
    ).toEqual({ kind: "ask", authorizationId: "a2", clientName: "Partner tool", scopes: ["openid", "email"] });
  });

  it("never treats an unnamed or empty-list client as first-party", () => {
    expect(decideConsent({ authorization_id: "a3", redirect_uri: CB, client: { id: "" } }, firstParty, allowed).kind).toBe("ask");
    expect(decideConsent({ authorization_id: "a4", redirect_uri: CB, client: { id: "cc-client" } }, firstPartyClientIds(undefined), allowed).kind).toBe("ask");
  });
});

describe("describeScope", () => {
  it("explains known scopes in plain words and names unknown ones", () => {
    expect(describeScope("email")).toBe("See your email address");
    expect(describeScope("custom:thing")).toBe("Access: custom:thing");
  });
});
