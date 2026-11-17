import { describe, expect, it } from "vitest";
import { DEFAULT_AFTER_SIGN_IN, safeNext } from "./redirects";

describe("safeNext", () => {
  it("keeps same-site paths, including query and hash", () => {
    expect(safeNext("/oauth/consent?authorization_id=abc")).toBe("/oauth/consent?authorization_id=abc");
    expect(safeNext("/account#security")).toBe("/account#security");
  });

  it.each([
    "https://evil.example/",
    "//evil.example",
    "/\\evil.example",
    "javascript:alert(1)",
    "account",
    "/ok\nSet-Cookie: x=1",
    "",
  ])("falls back for %j", (value) => {
    expect(safeNext(value)).toBe(DEFAULT_AFTER_SIGN_IN);
  });

  it("falls back when missing", () => {
    expect(safeNext(null)).toBe(DEFAULT_AFTER_SIGN_IN);
    expect(safeNext(undefined, "/elsewhere")).toBe("/elsewhere");
  });
});
