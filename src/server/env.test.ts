import { describe, expect, it } from "vitest";
import { parseEnv } from "./env";

const production = {
  NODE_ENV: "production",
  APP_URL: "https://account.example.com",
  DATABASE_URL: "postgres://u:p@db.example.com:5432/db",
  SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_x",
  SUPABASE_SECRET_KEY: "sb_secret_x",
};

describe("parseEnv", () => {
  it("accepts an empty development environment with defaults", () => {
    const env = parseEnv({ NODE_ENV: "development" });
    expect(env.APP_URL).toBe("http://localhost:3100");
    expect(env.DATABASE_URL).toBeUndefined();
  });

  it("rejects a malformed URL", () => {
    expect(() => parseEnv({ APP_URL: "not a url" })).toThrow(/APP_URL/);
  });

  it("requires every sign-in setting in production", () => {
    expect(() => parseEnv({ NODE_ENV: "production" })).toThrow(
      /APP_URL is required[\s\S]*DATABASE_URL is required[\s\S]*SUPABASE_URL is required[\s\S]*PUBLISHABLE_KEY is required[\s\S]*SECRET_KEY is required/,
    );
  });

  it("refuses http, local databases and a local Supabase in production", () => {
    expect(() =>
      parseEnv({ ...production, APP_URL: "http://example.com", DATABASE_URL: "postgres://u@localhost:5432/db", SUPABASE_URL: "http://localhost:54321" }),
    ).toThrow(/https[\s\S]*local database[\s\S]*https Supabase URL/);
  });

  it("accepts a complete production environment", () => {
    expect(parseEnv(production).APP_URL).toBe("https://account.example.com");
  });
});
