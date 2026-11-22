import { describe, expect, it } from "vitest";
import { assuranceDecision } from "./assurance";

describe("assuranceDecision", () => {
  it("lets someone without MFA continue after a password sign-in", () => {
    expect(assuranceDecision({ data: { currentLevel: "aal1", nextLevel: "aal1" }, error: null })).toBe("continue");
  });

  it("requires the second step when MFA is set up but not completed", () => {
    expect(assuranceDecision({ data: { currentLevel: "aal1", nextLevel: "aal2" }, error: null })).toBe("needs_mfa");
  });

  it("lets someone continue once MFA is completed", () => {
    expect(assuranceDecision({ data: { currentLevel: "aal2", nextLevel: "aal2" }, error: null })).toBe("continue");
  });

  it("fails closed when the level cannot be determined", () => {
    expect(assuranceDecision({ data: null, error: new Error("unavailable") })).toBe("unknown");
    expect(assuranceDecision({ data: null, error: null })).toBe("unknown");
    expect(assuranceDecision({ data: { currentLevel: "aal1", nextLevel: "aal1" }, error: new Error("x") })).toBe("unknown");
    expect(assuranceDecision({ data: { currentLevel: null, nextLevel: null }, error: null })).toBe("unknown");
  });
});
