import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Sql } from "postgres";

/*
  Applies supabase/migrations in name order, each in its own transaction, and records them in
  accounts_meta.migrations. On plain Postgres (local development, CI) it first applies supabase/local/*,
  which recreates the small part of Supabase the migrations rely on:
    00_roles.sql                the Supabase roles and default grants (once)
    01_auth_stub.sql            a stand-in auth schema, only when Supabase Auth is not running locally (once)
    02_auth_grants.always.sql   lets the API roles call auth.uid() (every run; idempotent, no default grants)
  Files are recorded like migrations, so a re-run never re-grants what a migration has since revoked.
  On a Supabase project (the supabase_admin role exists) the local files are never applied.
*/
const ROOT = join(process.cwd(), "supabase");

const sqlFiles = (dir: string) =>
  readdirSync(join(ROOT, dir))
    .filter((f) => f.endsWith(".sql"))
    .sort();

export async function migrate(sql: Sql, log: (msg: string) => void = () => {}, opts: { allowLocalShim?: boolean } = {}) {
  const [{ is_supabase, has_auth }] = await sql<{ is_supabase: boolean; has_auth: boolean }[]>`
    select exists (select 1 from pg_roles where rolname = 'supabase_admin') as is_supabase,
           to_regclass('auth.users') is not null as has_auth`;
  await sql.unsafe(
    "create schema if not exists accounts_meta; create table if not exists accounts_meta.migrations (name text primary key, applied_at timestamptz not null default now());",
  );
  if (!is_supabase) {
    if (opts.allowLocalShim === false) {
      throw new Error("This database is not a Supabase project. Refusing to apply the local compatibility files.");
    }
    const applied = new Set((await sql<{ name: string }[]>`select name from accounts_meta.migrations`).map((r) => r.name));
    for (const f of sqlFiles("local")) {
      const always = f.endsWith(".always.sql");
      if (!always && applied.has(`local/${f}`)) continue;
      if (f.startsWith("01_auth_stub") && has_auth) continue;
      await sql.begin(async (tx) => {
        await tx.unsafe(readFileSync(join(ROOT, "local", f), "utf8"));
        if (!always) await tx`insert into accounts_meta.migrations (name) values (${`local/${f}`})`;
      });
      log(`applied local/${f}`);
    }
  }
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
