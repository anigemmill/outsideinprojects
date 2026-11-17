import { describe, expect, it } from "vitest";
import { MESSAGES, messageFor } from "./messages";

describe("messageFor", () => {
  it("gives the same sign-in message for a wrong password and an unknown account", () => {
    expect(messageFor({ code: "invalid_credentials", status: 400 }, "sign-in")).toBe(MESSAGES.signInFailed);
    expect(messageFor({ code: "user_not_found", status: 400 }, "sign-in")).toBe(MESSAGES.signInFailed);
  });

  it("never confirms an existing account on sign-up or email requests", () => {
    expect(messageFor({ code: "user_already_exists", status: 422 }, "sign-up")).toBe(MESSAGES.checkEmail);
    expect(messageFor({ code: "email_address_not_authorized", status: 400 }, "email")).toBe(MESSAGES.checkEmail);
  });

  it("says the service is unavailable rather than blaming the password when Auth can't be reached", () => {
    expect(messageFor({ name: "AuthRetryableFetchError", status: 0 }, "sign-in")).toBe(MESSAGES.unavailable);
    expect(messageFor({ status: 503 }, "sign-up")).toBe(MESSAGES.unavailable);
  });

  it("explains rate limits and weak passwords", () => {
    expect(messageFor({ code: "over_request_rate_limit", status: 429 }, "sign-in")).toBe(MESSAGES.rateLimited);
    expect(messageFor({ code: "weak_password", status: 422 }, "sign-up")).toBe(MESSAGES.weakPassword);
  });
});
