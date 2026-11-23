import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migrate } from "./migrate";
import { guardMigrationTarget, loadTargetsConfig } from "./migration-guard";
import { identityComment } from "./migration-target";

/*
  The migration target guard against a real Postgres. Each case gets its own throwaway database.
  Skipped (not failed) when TEST_DATABASE_URL is not set, like the other database tests.
*/
const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("migration target guard (database)", () => {
  const admin = postgres(url ?? "", { max: 1, onnotice: () => {} });
  const created: string[] = [];

  async function freshDb(label: string) {
    const name = `guard_${label}_${process.pid}`;
    await admin.unsafe(`drop database if exists ${name}`); // test-only throwaway database
    await admin.unsafe(`create database ${name}`);
    created.push(name);
    const u = new URL(url ?? "");
    u.pathname = `/${name}`;
    return { dbUrl: u.toString(), sql: postgres(u.toString(), { max: 1, onnotice: () => {} }) };
  }
  const schemas = async (sql: postgres.Sql) =>
    (await sql<{ s: string }[]>`select nspname::text as s from pg_namespace where nspname like '%_meta' order by 1`).map((r) => r.s);

  beforeAll(() => expect(loadTargetsConfig().product).toBe("account_service"));
  afterAll(async () => {
    for (const name of created) await admin.unsafe(`drop database if exists ${name} with (force)`);
    await admin.end();
  });

  it("records the marker on a fresh local database, then migrates and accepts it again", async () => {
    const { dbUrl, sql } = await freshDb("fresh");
    try {
      const id = await guardMigrationTarget(sql, dbUrl);
      expect(id).toEqual({ product: "account_service", environment: "local", project_ref: null });
      await migrate(sql);
      const [{ comment }] = await sql<{ comment: string }[]>`select obj_description('accounts_meta'::regnamespace, 'pg_namespace') as comment`;
      expect(comment).toBe(identityComment(id));
      await expect(guardMigrationTarget(sql, dbUrl)).resolves.toEqual(id);
    } finally {
      await sql.end();
    }
  });

  it("refuses a database that belongs to Reel Deal and writes nothing", async () => {
    const { dbUrl, sql } = await freshDb("reeldeal");
    try {
      await sql.unsafe("create schema reeldeal_meta; create table reeldeal_meta.migrations (name text primary key)");
      await expect(guardMigrationTarget(sql, dbUrl)).rejects.toThrow(/belongs to reel_deal/);
      expect(await schemas(sql)).toEqual(["reeldeal_meta"]); // no accounts_meta was created
    } finally {
      await sql.end();
    }
  });

  it("refuses a database marked for another environment", async () => {
    const { dbUrl, sql } = await freshDb("otherenv");
    try {
      await sql.unsafe(
        `create schema accounts_meta; comment on schema accounts_meta is '${identityComment({ product: "account_service", environment: "development", project_ref: "egtlqrmujhxelczbyszj" })}'`,
      );
      await expect(guardMigrationTarget(sql, dbUrl)).rejects.toThrow(/marked as account_service \/ development/);
    } finally {
      await sql.end();
    }
  });

  it("refuses a Supabase project that is not configured, before connecting to anything", async () => {
    const { sql } = await freshDb("unlisted");
    try {
      await expect(guardMigrationTarget(sql, "postgresql://postgres:pw@db.jzshbaqfrrgsyiciuzfe.supabase.co:5432/postgres")).rejects.toThrow(
        /not one of account_service's projects/,
      );
      expect(await schemas(sql)).toEqual([]);
    } finally {
      await sql.end();
    }
  });

  it("only checks, without recording, when asked to", async () => {
    const { dbUrl, sql } = await freshDb("checkonly");
    try {
      await guardMigrationTarget(sql, dbUrl, undefined, { record: false });
      expect(await schemas(sql)).toEqual([]);
    } finally {
      await sql.end();
    }
  });
});
