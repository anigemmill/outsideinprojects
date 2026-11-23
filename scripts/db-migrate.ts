/*
  Applies pending migrations to DATABASE_URL (npm run db:migrate).
  First verifies the target is one of this product's databases (src/server/db/migration-guard.ts):
  a Supabase project must be listed in config/database-targets.json, and no other product's identity
  marker may be present. Nothing is written if that check fails.
*/
import postgres from "postgres";
import { migrate } from "../src/server/db/migrate";
import { guardMigrationTarget } from "../src/server/db/migration-guard";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("✗ DATABASE_URL is not set. For local development run: npm run setup");
  process.exit(1);
}
const sql = postgres(url, { max: 1, onnotice: () => {} });
try {
  const target = await guardMigrationTarget(sql, url);
  console.log(`  target verified: ${target.product} / ${target.environment}${target.project_ref ? ` / ${target.project_ref}` : ""}`);
  const applied = await migrate(sql, (m) => console.log(`  ${m}`), {
    allowLocalShim: process.env.ALLOW_LOCAL_SHIM !== "false",
  });
  console.log(applied.length ? `✓ ${applied.length} migration(s) applied` : "✓ database is up to date");
} catch (e) {
  console.error(`✗ ${(e as Error).message}`);
  process.exitCode = 1;
} finally {
  await sql.end();
}
