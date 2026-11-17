import { describe, expect, it } from "vitest";
import { parseEnv } from "./env";

describe("parseEnv", () => {
  it("accepts an empty development environment with defaults", () => {
    const env = parseEnv({ NODE_ENV: "development" });
    expect(env.APP_URL).toBe("http://localhost:3100");
    expect(env.DATABASE_URL).toBeUndefined();
  });

  it("rejects a malformed URL", () => {
    expect(() => parseEnv({ APP_URL: "not a url" })).toThrow(/APP_URL/);
  });

  it("requires APP_URL and DATABASE_URL in production", () => {
    expect(() => parseEnv({ NODE_ENV: "production" })).toThrow(/APP_URL is required[\s\S]*DATABASE_URL is required/);
  });

  it("refuses http and local databases in production", () => {
    expect(() =>
      parseEnv({ NODE_ENV: "production", APP_URL: "http://example.com", DATABASE_URL: "postgres://u@localhost:5432/db" }),
    ).toThrow(/https[\s\S]*local database/);
  });

  it("accepts a complete production environment", () => {
    const env = parseEnv({ NODE_ENV: "production", APP_URL: "https://app.example.com", DATABASE_URL: "postgres://u:p@db.example.com:5432/db" });
    expect(env.APP_URL).toBe("https://app.example.com");
  });
});
