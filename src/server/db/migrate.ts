import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Sql } from "postgres";

/*
  Applies supabase/migrations in name order, each in its own transaction, and records them in
  accounts_meta.migrations. On plain Postgres (local development, CI) it first applies supabase/local/*,
  which recreates the small part of Supabase the migrations rely on (roles, auth.uid()).
  On a Supabase project (auth.users exists) the local files are never applied.
*/
const ROOT = join(process.cwd(), "supabase");

const sqlFiles = (dir: string) =>
  readdirSync(join(ROOT, dir))
    .filter((f) => f.endsWith(".sql"))
    .sort();

export async function migrate(sql: Sql, log: (msg: string) => void = () => {}, opts: { allowLocalShim?: boolean } = {}) {
  const [{ has_auth }] = await sql<{ has_auth: boolean }[]>`select to_regclass('auth.users') is not null as has_auth`;
  if (!has_auth) {
    if (opts.allowLocalShim === false) {
      throw new Error("This database has no auth schema, so it is not a Supabase project. Refusing to apply the local compatibility files.");
    }
    for (const f of sqlFiles("local")) {
      await sql.unsafe(readFileSync(join(ROOT, "local", f), "utf8"));
      log(`applied local/${f}`);
    }
  }
  await sql.unsafe(
    "create schema if not exists accounts_meta; create table if not exists accounts_meta.migrations (name text primary key, applied_at timestamptz not null default now());",
  );
  const done = new Set((await sql<{ name: string }[]>`select name from accounts_meta.migrations`).map((r) => r.name));
  const pending = sqlFiles("migrations").filter((f) => !done.has(f));
  for (const f of pending) {
    await sql.begin(async (tx) => {
      await tx.unsafe(readFileSync(join(ROOT, "migrations", f), "utf8"));
      await tx`insert into accounts_meta.migrations (name) values (${f})`;
    });
    log(`applied migrations/${f}`);
  }
  return pending;
}
