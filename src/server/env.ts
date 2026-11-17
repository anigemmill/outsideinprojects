import "server-only";
import { z } from "zod";

/*
  Environment checks. Every setting the server reads is declared here, so a missing or
  wrong value fails at start-up with a clear message, not deep inside a request.
  Production is stricter: required settings must be present and must not be local values.
*/
const Schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.url().default("http://localhost:3100"),
  DATABASE_URL: z.string().min(1).optional(),
});

export type Env = z.infer<typeof Schema>;

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
    else if (/@(localhost|127\.0\.0\.1)[:/]/.test(env.DATABASE_URL)) problems.push("DATABASE_URL points at a local database");
    if (problems.length) throw new Error(`Invalid production environment:\n  ${problems.join("\n  ")}`);
  }
  return env;
}

let cached: Env | undefined;
export function env(): Env {
  return (cached ??= parseEnv(process.env));
}
