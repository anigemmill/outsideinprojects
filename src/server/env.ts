import "server-only";
import { z } from "zod";

/*
  Environment checks. Every setting the server reads is declared here, so a missing or
  wrong value fails at start-up with a clear message, not deep inside a request.
  Production is stricter: required settings must be present and must not be local values.
  What each variable is for and where its value is kept: docs/environments.md.
*/
const Schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.url().default("http://localhost:3100"),
  DATABASE_URL: z.string().min(1).optional(),
  SUPABASE_URL: z.url().optional(),
  SUPABASE_PUBLISHABLE_KEY: z.string().min(1).optional(),
  SUPABASE_SECRET_KEY: z.string().min(1).optional(),
  // OAuth client ids of the Outside In products, approved without a consent prompt.
  FIRST_PARTY_CLIENT_IDS: z.string().optional(),
  // Origins product callbacks may use (comma-separated). Empty = every OAuth redirect is refused.
  PRODUCT_REDIRECT_ORIGINS: z.string().optional(),
});

export type Env = z.infer<typeof Schema>;

const isLocal = (url: string) => /^(https?|postgres(ql)?):\/\/([^@/]*@)?(localhost|127\.0\.0\.1)[:/]/.test(url);

export function parseEnv(source: Record<string, string | undefined>): Env {
  const parsed = Schema.safeParse(source);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`);
    throw new Error(`Invalid environment:\n  ${fields.join("\n  ")}`);
  }
  const env = parsed.data;
  if (env.NODE_ENV === "production") {
    const problems: string[] = [];
    if (!source.APP_URL) problems.push("APP_URL is required in production");
    else if (!env.APP_URL.startsWith("https://")) problems.push("APP_URL must use https in production");
    if (!env.DATABASE_URL) problems.push("DATABASE_URL is required in production");
    else if (isLocal(env.DATABASE_URL)) problems.push("DATABASE_URL points at a local database");
    if (!env.SUPABASE_URL) problems.push("SUPABASE_URL is required in production");
    else if (!env.SUPABASE_URL.startsWith("https://") || isLocal(env.SUPABASE_URL)) problems.push("SUPABASE_URL must be an https Supabase URL in production");
    if (!env.SUPABASE_PUBLISHABLE_KEY) problems.push("SUPABASE_PUBLISHABLE_KEY is required in production");
    if (!env.SUPABASE_SECRET_KEY) problems.push("SUPABASE_SECRET_KEY is required in production");
    if (problems.length) throw new Error(`Invalid production environment:\n  ${problems.join("\n  ")}`);
  }
  return env;
}

let cached: Env | undefined;
export function env(): Env {
  return (cached ??= parseEnv(process.env));
}

/** The Supabase Auth settings the sign-in pages need, or a clear error if they are not configured. */
export function authConfig() {
  const e = env();
  if (!e.SUPABASE_URL || !e.SUPABASE_PUBLISHABLE_KEY) {
    throw new Error("Sign-in is not configured: set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY (docs/development.md).");
  }
  return { url: e.SUPABASE_URL, publishableKey: e.SUPABASE_PUBLISHABLE_KEY };
}

export function authConfigured(): boolean {
  const e = env();
  return Boolean(e.SUPABASE_URL && e.SUPABASE_PUBLISHABLE_KEY);
}
