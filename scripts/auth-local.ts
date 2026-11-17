/*
  LOCAL ONLY. Runs real Supabase Auth (GoTrue) on this machine so the account pages and the full
  sign-in flow can be developed and tested without a hosted project (npm run auth:local).

  - Downloads the pinned Supabase Auth release from GitHub once and checks its SHA-256.
  - Generates local-only ES256 signing keys (asymmetric, like the hosted projects will use).
  - Starts Supabase Auth against the local Postgres (npm run db:local), with the OAuth 2.1 server on.
  - A small gateway serves it at http://localhost:54321/auth/v1, the same URL layout as a hosted project.
  - A mail catcher receives sign-up, magic-link and reset emails; nothing leaves this machine.
    The latest message for an address is at http://localhost:54321/__local/mail?to=<address>.
  - Writes .data/auth/local.env with the URL and the local keys for the app and the tests.

  Everything here is git-ignored under .data/ and is never used for development or production
  projects, which get their own keys from Supabase.
*/
import { spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import http from "node:http";
import { join } from "node:path";
import { exportJWK, generateKeyPair, importJWK, SignJWT, type JWK } from "jose";
import { SMTPServer } from "smtp-server";

export const AUTH_VERSION = "v2.198.0";
const AUTH_TARBALL = `https://github.com/supabase/auth/releases/download/${AUTH_VERSION}/auth-${AUTH_VERSION}-x86.tar.gz`;
// SHA-256 of the release tarball, recorded when it was first downloaded (17 Nov 2026). Supabase
// does not publish checksums for releases, so this pins exactly the file that was reviewed.
const AUTH_SHA256 = "5ca93ca47b9daaf23bc601573c57047d4f8aae41e018dde372b2f71056d9a1a5";

const ROOT = join(process.cwd(), ".data", "auth");
const BIN_DIR = join(ROOT, AUTH_VERSION);
const MAIL_DIR = join(ROOT, "mail");
const GATEWAY_PORT = 54321;
const AUTH_PORT = 9999;
const SMTP_PORT = 54325;
const APP_URL = process.env.APP_URL ?? "http://localhost:3100";
const DB_URL = process.env.AUTH_DATABASE_URL ?? "postgres://postgres@localhost:54331/accounts?sslmode=disable";
export const LOCAL_SUPABASE_URL = `http://localhost:${GATEWAY_PORT}`;
export const LOCAL_ISSUER = `${LOCAL_SUPABASE_URL}/auth/v1`;

async function ensureBinary() {
  const bin = join(BIN_DIR, "auth");
  if (existsSync(bin)) return bin;
  mkdirSync(BIN_DIR, { recursive: true });
  console.log(`Downloading Supabase Auth ${AUTH_VERSION}…`);
  const res = await fetch(AUTH_TARBALL);
  if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);
  const data = Buffer.from(await res.arrayBuffer());
  const sha = createHash("sha256").update(data).digest("hex");
  if (sha !== AUTH_SHA256) throw new Error(`Checksum mismatch for the Supabase Auth download (got ${sha}). Refusing to run it.`);
  const tarball = join(BIN_DIR, "auth.tgz");
  writeFileSync(tarball, data);
  await run("tar", ["-xzf", tarball, "-C", BIN_DIR]);
  return bin;
}

function run(cmd: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: "inherit" });
    p.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited with ${code}`))));
  });
}

type LocalKeys = { jwk: JWK; jwtSecret: string; publishableKey: string; secretKey: string };

async function ensureKeys(): Promise<LocalKeys> {
  const file = join(ROOT, "keys.json");
  if (existsSync(file)) return JSON.parse(readFileSync(file, "utf8"));
  const { privateKey } = await generateKeyPair("ES256", { extractable: true });
  const jwk = { ...(await exportJWK(privateKey)), kid: `local-${randomBytes(4).toString("hex")}`, alg: "ES256", use: "sig", key_ops: ["sign", "verify"] };
  const signer = await importJWK(jwk, "ES256");
  // Long-lived local API keys, the local equivalent of a project's publishable and secret keys.
  const apiKey = (role: "anon" | "service_role") =>
    new SignJWT({ role }).setProtectedHeader({ alg: "ES256", kid: jwk.kid, typ: "JWT" }).setIssuer("supabase-local").setIssuedAt().setExpirationTime("10y").sign(signer);
  const keys: LocalKeys = { jwk, jwtSecret: randomBytes(32).toString("hex"), publishableKey: await apiKey("anon"), secretKey: await apiKey("service_role") };
  mkdirSync(ROOT, { recursive: true });
  writeFileSync(file, JSON.stringify(keys, null, 2), { mode: 0o600 });
  return keys;
}

function startMailCatcher() {
  mkdirSync(MAIL_DIR, { recursive: true });
  const latest = new Map<string, { to: string; subject: string; raw: string; at: string }>();
  const server = new SMTPServer({
    authOptional: true,
    disabledCommands: ["STARTTLS"],
    onData(stream, session, done) {
      const chunks: Buffer[] = [];
      stream.on("data", (c: Buffer) => chunks.push(c));
      stream.on("end", () => {
        const raw = Buffer.concat(chunks).toString("utf8");
        const subject = /^Subject: (.*)$/m.exec(raw)?.[1] ?? "";
        for (const rcpt of session.envelope.rcptTo) {
          const msg = { to: rcpt.address.toLowerCase(), subject, raw, at: new Date().toISOString() };
          latest.set(msg.to, msg);
          writeFileSync(join(MAIL_DIR, `${Date.now()}-${msg.to}.eml`), raw);
        }
        done();
      });
    },
  });
  server.listen(SMTP_PORT, "127.0.0.1");
  return latest;
}

function startGateway(mail: ReturnType<typeof startMailCatcher>) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", LOCAL_SUPABASE_URL);
    if (url.pathname === "/__local/mail") {
      const msg = mail.get((url.searchParams.get("to") ?? "").toLowerCase());
      res.writeHead(msg ? 200 : 404, { "content-type": "application/json" });
      res.end(JSON.stringify(msg ?? { error: "no message" }));
      return;
    }
    if (!url.pathname.startsWith("/auth/v1")) {
      res.writeHead(404).end();
      return;
    }
    const upstream = http.request(
      { host: "127.0.0.1", port: AUTH_PORT, method: req.method, path: url.pathname.slice("/auth/v1".length) + url.search, headers: { ...req.headers, host: `127.0.0.1:${AUTH_PORT}` } },
      (up) => {
        res.writeHead(up.statusCode ?? 502, up.headers);
        up.pipe(res);
      },
    );
    upstream.on("error", () => res.writeHead(502).end("Supabase Auth is not reachable"));
    req.pipe(upstream);
  });
  server.listen(GATEWAY_PORT, "127.0.0.1");
}

async function main() {
  const bin = await ensureBinary();
  const keys = await ensureKeys();
  const env: Record<string, string> = {
    PATH: process.env.PATH ?? "",
    GOTRUE_API_HOST: "127.0.0.1",
    PORT: String(AUTH_PORT),
    API_EXTERNAL_URL: LOCAL_ISSUER,
    GOTRUE_SITE_URL: APP_URL,
    // Redirects only to the account pages and the local test client.
    GOTRUE_URI_ALLOW_LIST: `${APP_URL}/**,http://localhost:4555/**`,
    GOTRUE_DB_DRIVER: "postgres",
    DATABASE_URL: DB_URL,
    GOTRUE_DB_MIGRATIONS_PATH: join(BIN_DIR, "migrations"),
    GOTRUE_JWT_SECRET: keys.jwtSecret,
    GOTRUE_JWT_KEYS: JSON.stringify([keys.jwk]),
    GOTRUE_JWT_ISSUER: LOCAL_ISSUER,
    GOTRUE_JWT_AUD: "authenticated",
    GOTRUE_JWT_EXP: "900", // 15-minute access tokens (identity-architecture.md §7)
    GOTRUE_JWT_DEFAULT_GROUP_NAME: "authenticated",
    GOTRUE_JWT_ADMIN_ROLES: "service_role",
    GOTRUE_OAUTH_SERVER_ENABLED: "true",
    GOTRUE_OAUTH_SERVER_AUTHORIZATION_PATH: "/oauth/consent",
    GOTRUE_DISABLE_SIGNUP: "false",
    GOTRUE_EXTERNAL_EMAIL_ENABLED: "true",
    GOTRUE_MAILER_AUTOCONFIRM: "false",
    GOTRUE_PASSWORD_MIN_LENGTH: "12",
    GOTRUE_SECURITY_REFRESH_TOKEN_ROTATION_ENABLED: "true",
    GOTRUE_MFA_TOTP_ENROLL_ENABLED: "true",
    GOTRUE_MFA_TOTP_VERIFY_ENABLED: "true",
    GOTRUE_MFA_MAX_ENROLLED_FACTORS: "10",
    GOTRUE_SMTP_HOST: "127.0.0.1",
    GOTRUE_SMTP_PORT: String(SMTP_PORT),
    GOTRUE_SMTP_ADMIN_EMAIL: "no-reply@accounts.local",
    GOTRUE_SMTP_SENDER_NAME: "Outside In account (local)",
    GOTRUE_RATE_LIMIT_EMAIL_SENT: "1000",
    GOTRUE_RATE_LIMIT_VERIFY: "1000",
    GOTRUE_RATE_LIMIT_TOKEN_REFRESH: "1000",
    GOTRUE_RATE_LIMIT_SIGN_IN_SIGN_UPS: "1000",
    GOTRUE_MAILER_URLPATHS_RECOVERY: "/auth/v1/verify",
    GOTRUE_MAILER_URLPATHS_CONFIRMATION: "/auth/v1/verify",
    GOTRUE_MAILER_URLPATHS_INVITE: "/auth/v1/verify",
    GOTRUE_MAILER_URLPATHS_EMAIL_CHANGE: "/auth/v1/verify",
    GOTRUE_LOG_LEVEL: "warn",
  };
  writeFileSync(
    join(ROOT, "local.env"),
    [
      `SUPABASE_URL=${LOCAL_SUPABASE_URL}`,
      `SUPABASE_PUBLISHABLE_KEY=${keys.publishableKey}`,
      `SUPABASE_SECRET_KEY=${keys.secretKey}`,
      `ACCOUNTS_ISSUER=${LOCAL_ISSUER}`,
      "",
    ].join("\n"),
    { mode: 0o600 },
  );
  const log = createWriteStream(join(ROOT, "auth.log"), { flags: "a" });
  const child = spawn(bin, [], { env: env as NodeJS.ProcessEnv, stdio: ["ignore", "pipe", "pipe"] });
  child.stdout.pipe(log);
  child.stderr.pipe(log);
  child.on("exit", (code: number | null) => {
    console.error(`Supabase Auth exited (${code}). See .data/auth/auth.log`);
    process.exit(code ?? 1);
  });
  for (const sig of ["SIGINT", "SIGTERM"] as const) process.on(sig, () => { child.kill(); process.exit(0); });

  startGateway(startMailCatcher());
  for (let i = 0; i < 100; i++) {
    const ok = await fetch(`${LOCAL_ISSUER}/health`).then((r) => r.ok).catch(() => false);
    if (ok) {
      console.log(`✓ Supabase Auth ${AUTH_VERSION} at ${LOCAL_ISSUER} (mail: ${LOCAL_SUPABASE_URL}/__local/mail?to=…)`);
      console.log("  Keys and URL written to .data/auth/local.env. Next: npm run db:migrate");
      return;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("Supabase Auth did not become healthy. See .data/auth/auth.log");
}

main().catch((e) => {
  console.error(`✗ ${(e as Error).message}`);
  process.exit(1);
});
