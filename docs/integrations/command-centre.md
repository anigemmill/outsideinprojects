# Command Centre: first integration with the account service

Status: **plan, 22 Nov 2026. Not started.** Command Centre is the first product to integrate because it
has no users, no deployment and no data: the lowest-risk place to prove the shared identity design
end to end before any live product moves.

**Gate:** integration starts only when `security-review.md` §1–§4 rows needed below are Verified
(roadmap steps 1–5 in `plan.md`). Work that needs no real tokens (step 0 below) can start earlier.

## 0. What exists in Command Centre today (Verified, 18–22 Nov)

Next.js 16 App Router, TypeScript strict, zod environment checks (`src/server/env.ts`) validated at
start-up (`src/instrumentation.ts`), `postgres` driver, one foundation migration (deny-by-default
grants, `app.tables_missing_rls`), local Postgres plus a Supabase compatibility file, `auth.uid()` from
`request.jwt.claims` proven in database tests, migration target guard, design tokens, CI (secrets,
dependency audit, migrations, tokens, production settings, types, lint, tests, build). **No sign-in,
no tables, no screens.**

## 1. Changes, in order

### 1.1 Shared token verifier (from the foundation package)

- `packages/foundation/auth/verify.ts` (shared, written once, `plan.md` step 2): ES256 allow-list, issuer,
  `client_id`, expiry and skew, JWKS cache with re-fetch on unknown `kid`.
- Command Centre imports it; no product-specific verification logic.

### 1.2 Environment (`src/server/env.ts`, `.env.example` names only)

| Variable | Rule |
|---|---|
| `ACCOUNTS_ISSUER` | URL; production must be the production issuer and https |
| `ACCOUNTS_CLIENT_ID` | Required when sign-in is on |
| `ACCOUNTS_CLIENT_SECRET` | Secret; server-only; required in production |
| `SESSION_ENCRYPTION_KEY` | 32 random bytes, base64; required in production |
| `EVENT_SIGNING_SECRET` | Secret; required in production |
| `ACCOUNT_APP_URL` | Where "Manage account" and "sign out everywhere" link (`http://localhost:3100` in development) |

`check:env:production` gains these; CI's production-settings check proves missing ones fail.

### 1.3 Sign-in routes (`src/app/auth/…`)

| Route | Does |
|---|---|
| `GET /auth/sign-in?next=` | Creates `state`, `nonce` and a PKCE verifier (stored in a short-lived encrypted httpOnly cookie), redirects to the issuer's `/oauth/authorize` |
| `GET /auth/callback` | Checks `state`; exchanges the code with the verifier and client secret (server to server); verifies the ID token (`nonce`) and access token; writes the session cookie; redirects to a same-origin `next` |
| `POST /auth/sign-out` | Revokes Command Centre's refresh token, clears the cookie (product sign-out, D6) |
| Link "Sign out everywhere" | Goes to the account app |

### 1.4 Session (`src/server/auth/session.ts`)

- One encrypted (AES-256-GCM), httpOnly, Secure, `SameSite=Lax`, host-only cookie with the access and
  refresh tokens and expiry.
- On each request: verify the access token; if expiring within 60 s, refresh server-side; on refresh
  failure, end the session.
- Check the local revocation list (`session.revoked` events).

### 1.5 Principal and database context (`src/server/auth/principal.ts`, `src/server/db/`)

- Principal = `{ kind: "user", userId }` from the verified `sub` only.
- Every user request runs in a transaction with `set local role authenticated` and
  `request.jwt.claims` = `{ sub, role: "authenticated" }`, so RLS applies (proven in M1 tests).
- Background and system work uses restricted roles, never the service role (repository audit R6).

### 1.6 Mirrors and events (migrations + `src/app/api/account-events/route.ts`)

| Table | Purpose |
|---|---|
| `organisations`, `memberships`, `users` | Mirrors (read-only to customers), keyed by the account service's ids |
| `cc_product_access`, `cc_entitlements` | Command Centre's rows only |
| `account_event_receipts`, `account_mirror_state` | Idempotency and per-organisation ordering (data model review G11) |
| `revoked_sessions` | Session revocation list |

The event endpoint verifies the HMAC signature and timestamp, rejects replays, applies events in
sequence per organisation inside one transaction, and holds an organisation on a sequence gap.

### 1.7 Tenancy and permissions (milestone M2b)

`workspaces`, `brands`, `cc_access` (with join tables for scope), roles and permissions,
`app.has_permission()` with `search_path = ''`, audit events and record versions, URL-based
organisation resolution (`/{orgSlug}/{workspaceSlug}/…`, 404 when not a member).

### 1.8 UI

Sign-in button and error states, organisation switcher, "no access" and "not subscribed" states (send
to the account app), product switcher slot (A7), profile menu with "Manage account" and "Sign out".

## 2. Tests (all in CI)

| Test | Layer |
|---|---|
| Verifier rejects every case in `security-review.md` §1.1 | Unit (shared package) |
| Callback rejects wrong `state`, wrong `nonce`, replayed code, missing PKCE | Unit with a local test issuer |
| Session cookie is encrypted, httpOnly, Secure, host-only; tampering ends the session | Unit |
| Removed member, removed product access, suspended organisation and `session.revoked` take effect on the next request | Database + unit |
| Events: bad signature, old timestamp, replay, out of order, gap | Unit + database |
| Isolation suite: every table, two organisations, guessed ids (spec 03 §7) | Database |
| End to end against `accounts-dev`: sign up, confirm email, sign in, MFA, consent auto-approved, back in Command Centre, sign out, sign out everywhere | Playwright (development only) |

## 3. Development first, local issuer before real tokens

1. **Now possible (no account service needed):** 1.2, 1.4–1.7 and their tests against a local test
   issuer (test ES256 key, JWKS served by the test, signed test tokens and events).
2. **After `plan.md` step 2:** swap in the shared verifier; run against `accounts-dev`.
3. **After steps 3–5:** real organisations, product access and events.
4. **Production** only after `accounts-prod` exists (cost approval) and Command Centre has a host
   (`commandcentre.theoutsidein.nz`, D5).

## 4. Exit criteria

A person signs up once on the account app, opens Command Centre without a second sign-in, sees only
their organisation, is blocked within a minute of being removed, and is signed out by "sign out
everywhere"; every rejection case is tested; the isolation suite passes for every table.
