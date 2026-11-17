# Environments, variables and secrets

Every setting the account service and Command Centre read. **No values are ever written in this
repository, in issues or in chat.** This file lists names, purpose and where each value is kept.

## Where values live

| Place | Holds | Who can read |
|---|---|---|
| `.env.local` on a developer machine | Local and development values only. Git-ignored | That developer |
| Vercel project environment variables (per environment: Development, Preview, Production) | Deployed values; secrets marked Sensitive | Vercel team members with access |
| GitHub Actions secrets | Only what CI needs (today: nothing; CI uses a throwaway Postgres) | Repository admins |
| Supabase dashboard | Keys are generated there and copied into Vercel; never exported elsewhere | Supabase organisation members |

Rules:

- Development and production never share a value. Each environment has its own project, keys and
  OAuth client secrets.
- Secret keys and the database password are server-only: never in a `NEXT_PUBLIC_` variable, never sent
  to a browser. `npm run check:env` refuses production with missing or local values.
- Rotate a secret immediately if it is ever pasted into a chat, issue, log or commit, and record the
  rotation in `docs/decisions.md` (date, which key, why), never the value.

## Account service (`anigemmill/outsideinprojects`)

| Variable | Secret? | Purpose | Local | Development | Production |
|---|---|---|---|---|---|
| `APP_URL` | No | Public URL of the account pages | `http://localhost:3100` | dev URL | `https://account.[DOMAIN]` |
| `DATABASE_URL` | **Yes** | Direct Postgres connection for migrations and server queries | local Postgres | `accounts-dev` pooler URL | `accounts-prod` pooler URL |
| `NEXT_PUBLIC_SUPABASE_URL` | No | Supabase Auth endpoint for the account pages | `accounts-dev` URL | `accounts-dev` URL | `accounts-prod` URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | No (public by design; RLS protects data) | Browser client for sign-in | dev key | dev key | prod key |
| `SUPABASE_SECRET_KEY` | **Yes** | Server-only admin actions (register OAuth clients, invite users). Bypasses RLS: used only in audited server code | dev key | dev key | prod key |
| `ACCOUNTS_ISSUER` | No | Expected token issuer, `https://<ref>.supabase.co/auth/v1` | dev issuer | dev issuer | prod issuer |
| `SERVICE_TOKEN_SIGNING_KEY` | **Yes** | Private key for service tokens (A5) | generated locally | generated per environment | generated per environment |
| `EVENT_SIGNING_SECRET_<PRODUCT>` | **Yes** | Signs events delivered to each product (A6) | test value | per product | per product |

## Command Centre (`anigemmill/commandcentre`)

| Variable | Secret? | Purpose | Local | Development | Production |
|---|---|---|---|---|---|
| `APP_URL` | No | Public URL of Command Centre | `http://localhost:3000` | dev URL | `https://[COMMAND-CENTRE-DOMAIN]` |
| `DATABASE_URL` | **Yes** | Command Centre's own database | local Postgres | local Postgres until first deploy, then `commandcentre-dev` | `commandcentre-prod` |
| `ACCOUNTS_ISSUER` | No | The only issuer Command Centre accepts | `accounts-dev` issuer | `accounts-dev` issuer | `accounts-prod` issuer |
| `ACCOUNTS_CLIENT_ID` | No | Command Centre's OAuth client id in the account service | dev client | dev client | prod client |
| `ACCOUNTS_CLIENT_SECRET` | **Yes** | Confidential-client secret for the code exchange | dev secret | dev secret | prod secret |
| `SESSION_ENCRYPTION_KEY` | **Yes** | Encrypts the session cookie holding tokens (32 random bytes) | generated locally | per environment | per environment |
| `EVENT_SIGNING_SECRET` | **Yes** | Verifies events from the account service (A6) | test value | per environment | per environment |

Variables are added to `.env.example` (names only) and to `src/server/env.ts` (validation) in the same
change that first uses them.

## Supabase projects

| Project | Organisation | Region | Purpose | Data | Status |
|---|---|---|---|---|---|
| `accounts-dev` | Proposed: a separate free "Outside In Development" organisation (see `decisions.md`) | Sydney (`ap-southeast-2`) | Development identity for all products | Synthetic only | **Not created; awaiting approval** |
| `accounts-prod` | ANI (Pro) | Sydney | Production identity | Real | Later, before first customer use |
| `commandcentre-dev` | Same as `accounts-dev` | Sydney | Command Centre development data | Synthetic only | Later, at first deploy |
| `commandcentre-prod` | ANI (Pro) | Sydney | Command Centre production data | Real | Later |
