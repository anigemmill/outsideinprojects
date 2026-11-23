import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Sql } from "postgres";
import {
  checkIdentity,
  classifyDatabaseUrl,
  expectedIdentity,
  type Identity,
  MigrationTargetError,
  type MetaSchemaState,
  READ_MARKERS_SQL,
  recordIdentitySql,
  type TargetsConfig,
} from "./migration-target";

/* This repository's adapter for the shared migration target guard (migration-target.ts). */

export function loadTargetsConfig(path = join(process.cwd(), "config", "database-targets.json")): TargetsConfig {
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as { product: TargetsConfig["product"]; projects?: TargetsConfig["projects"] };
    return { product: raw.product, projects: raw.projects ?? {} };
  } catch (e) {
    throw new MigrationTargetError(`Refusing to migrate: ${path} cannot be read (${(e as Error).message}).`);
  }
}

/**
 * Verifies that `databaseUrl` is one of this product's databases and records the identity marker
 * when it is missing. Call before migrate(); it throws MigrationTargetError and writes nothing on
 * any doubt. With `record: false` it only checks (for read-only commands).
 */
export async function guardMigrationTarget(
  sql: Sql,
  databaseUrl: string,
  config: TargetsConfig = loadTargetsConfig(),
  opts: { record?: boolean } = {},
): Promise<Identity> {
  const expected = expectedIdentity(classifyDatabaseUrl(databaseUrl), config);
  let found: MetaSchemaState[];
  try {
    found = await sql.unsafe<MetaSchemaState[]>(READ_MARKERS_SQL);
  } catch (e) {
    throw new MigrationTargetError(`Refusing to migrate: the database's identity cannot be read (${(e as Error).message}).`);
  }
  const { record } = checkIdentity(expected, found);
  if (record && opts.record !== false) await sql.unsafe(recordIdentitySql(expected));
  return expected;
}
