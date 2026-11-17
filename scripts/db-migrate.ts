/* Applies pending migrations to DATABASE_URL (npm run db:migrate). */
import postgres from "postgres";
import { migrate } from "../src/server/db/migrate";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("✗ DATABASE_URL is not set. For local development run: npm run setup");
  process.exit(1);
}
const sql = postgres(url, { max: 1, onnotice: () => {} });
try {
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
