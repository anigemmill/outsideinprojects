/* Checks the current environment the same way the server does at start-up (npm run check:env). */
import { parseEnv } from "../src/server/env";

try {
  const env = parseEnv(process.env);
  console.log(`✓ environment valid (${env.NODE_ENV})`);
} catch (e) {
  console.error(`✗ ${(e as Error).message}`);
  process.exit(1);
}
