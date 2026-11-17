import { describe, expect, it } from "vitest";
import { NewPasswordInput, parseForm, SignInInput, SignUpInput, TotpCodeInput } from "./schemas";

const form = (values: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(values)) f.set(k, v);
  return f;
};

describe("auth form validation", () => {
  it("normalises the email address", () => {
    const r = parseForm(SignInInput, form({ email: "  Aroha@Example.COM ", password: "x" }));
    expect(r).toEqual({ ok: true, data: { email: "aroha@example.com", password: "x" } });
  });

  it("rejects a malformed email with a field message", () => {
    const r = parseForm(SignInInput, form({ email: "not-an-email", password: "x" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.email).toMatch(/valid email/);
  });

  it("requires 12-character passwords on sign-up", () => {
    const r = parseForm(SignUpInput, form({ email: "a@example.com", password: "short" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.password).toMatch(/12 characters/);
  });

  it("requires matching passwords when setting a new one", () => {
    const r = parseForm(NewPasswordInput, form({ password: "a-long-enough-password", confirm: "different-password" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.confirm).toMatch(/don't match/);
  });

  it("accepts only 6-digit authenticator codes", () => {
    expect(parseForm(TotpCodeInput, form({ factorId: "f1", code: " 123456 " })).ok).toBe(true);
    expect(parseForm(TotpCodeInput, form({ factorId: "f1", code: "12345a" })).ok).toBe(false);
  });
});
