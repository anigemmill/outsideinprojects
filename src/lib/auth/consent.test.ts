import { describe, expect, it } from "vitest";
import { decideConsent, describeScope, firstPartyClientIds } from "./consent";

const firstParty = firstPartyClientIds(" cc-client , findable-client,,");

describe("decideConsent", () => {
  it("follows the redirect when consent was already given", () => {
    expect(decideConsent({ redirect_url: "https://cc.example/callback?code=1" }, firstParty)).toEqual({
      kind: "redirect",
      url: "https://cc.example/callback?code=1",
    });
  });

  it("auto-approves first-party products", () => {
    expect(decideConsent({ authorization_id: "a1", client: { id: "cc-client" } }, firstParty)).toEqual({ kind: "auto-approve", authorizationId: "a1" });
  });

  it("asks the person for any other client", () => {
    expect(decideConsent({ authorization_id: "a2", client: { id: "other", name: "Partner tool" }, scope: "openid  email" }, firstParty)).toEqual({
      kind: "ask",
      authorizationId: "a2",
      clientName: "Partner tool",
      scopes: ["openid", "email"],
    });
  });

  it("never treats an unnamed or empty-list client as first-party", () => {
    expect(decideConsent({ authorization_id: "a3", client: { id: "" } }, firstParty).kind).toBe("ask");
    expect(decideConsent({ authorization_id: "a4", client: { id: "cc-client" } }, firstPartyClientIds(undefined)).kind).toBe("ask");
  });
});

describe("describeScope", () => {
  it("explains known scopes in plain words and names unknown ones", () => {
    expect(describeScope("email")).toBe("See your email address");
    expect(describeScope("custom:thing")).toBe("Access: custom:thing");
  });
});
