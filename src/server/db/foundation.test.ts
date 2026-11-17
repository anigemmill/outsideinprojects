import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migrate } from "./migrate";

/*
  Database tests. They need a disposable database: npm run test:db starts the local one,
  CI uses its own Postgres service. Skipped (not failed) when TEST_DATABASE_URL is not set.
*/
const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("database foundation", () => {
  const sql = postgres(url ?? "", { max: 1, onnotice: () => {} });

  beforeAll(async () => {
    await migrate(sql);
  });
  afterAll(async () => {
    await sql.end();
  });

  it("is idempotent: a second run applies nothing", async () => {
    expect(await migrate(sql)).toEqual([]);
  });

  it("has no public table without RLS and policies", async () => {
    expect(await sql`select * from app.tables_missing_rls`).toEqual([]);
  });

  // Each check below runs in a transaction that is rolled back, so the database is left unchanged.
  const inRollback = async (fn: (tx: postgres.TransactionSql) => Promise<void>) => {
    await sql
      .begin(async (tx) => {
        await fn(tx);
        throw new Error("rollback");
      })
      .catch((e: Error) => {
        if (e.message !== "rollback") throw e;
      });
  };

  it("flags a new table until it has RLS and a policy", async () => {
    await inRollback(async (tx) => {
      await tx`create table public.guard_probe (id int primary key)`;
      expect(await tx`select problem from app.tables_missing_rls where table_name = 'guard_probe'`).toEqual([{ problem: "rls disabled" }]);
      await tx`alter table public.guard_probe enable row level security`;
      expect(await tx`select problem from app.tables_missing_rls where table_name = 'guard_probe'`).toEqual([{ problem: "no policies" }]);
      await tx`create policy "probe" on public.guard_probe for select to authenticated using (false)`;
      expect(await tx`select problem from app.tables_missing_rls where table_name = 'guard_probe'`).toEqual([]);
    });
  });

  it("gives new tables no privileges for anon or authenticated by default", async () => {
    await inRollback(async (tx) => {
      await tx`create table public.grant_probe (id int primary key)`;
      const [row] = await tx`
        select has_table_privilege('anon', 'public.grant_probe', 'select') as anon,
               has_table_privilege('authenticated', 'public.grant_probe', 'select') as authenticated`;
      expect(row).toEqual({ anon: false, authenticated: false });
    });
  });

  it("reads the signed-in user from the request's JWT claims, as on Supabase", async () => {
    await inRollback(async (tx) => {
      await tx`select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111"}', true)`;
      const [row] = await tx`select auth.uid()::text as uid`;
      expect(row.uid).toBe("11111111-1111-4111-8111-111111111111");
    });
  });
});
