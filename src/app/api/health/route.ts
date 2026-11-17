import { env } from "@/server/env";

// Liveness check for the host. Reports configuration only; it does not connect to the database.
export const dynamic = "force-dynamic";

export function GET() {
  const e = env();
  return Response.json({
    status: "ok",
    service: "outside-in-accounts",
    checks: { database: e.DATABASE_URL ? "configured" : "not configured" },
  });
}
