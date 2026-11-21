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
| `SUPABASE_URL` | No | Supabase Auth endpoint for the account pages (read at start-up, not build time) | `accounts-dev` URL | `accounts-dev` URL | `accounts-prod` URL |
| `SUPABASE_PUBLISHABLE_KEY` | No (public by design; RLS protects data). Read on the server only, so it isn't baked into the build |  Sign-in calls from the account pages' server | dev key | dev key | prod key |
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

## Supabase projects: which project belongs to which product

Every project belongs to exactly one product. Each product's migration runner refuses any project not
listed in that product's `config/database-targets.json`, and any database carrying another product's
identity marker (`src/server/db/migration-target.ts`, shared by all three repositories).

| Project | Project id | Organisation | Region | Product (owner) | Environment | Data | Status |
|---|---|---|---|---|---|---|---|
| `accounts-dev` | `egtlqrmujhxelczbyszj` | Outside In Development (free) | Sydney (`ap-southeast-2`) | **Account service** (identity for all products) | Development | Synthetic only | **Created 19 Nov 2026.** Foundation migration applied; identity marker `account_service / development`. Auth settings: see below |
| `accounts-prod` | — | ANI (Pro) | Sydney | Account service | Production | Real | Later, before first customer use |
| `commandcentre-dev` | — | Outside In Development | Sydney | Command Centre | Development | Synthetic only | Later, at first deploy |
| `commandcentre-prod` | — | ANI (Pro) | Sydney | Command Centre | Production | Real | Later |
| `reeldeal` | `jzshbaqfrrgsyiciuzfe` | (Reel Deal's organisation) | Sydney | **Reel Deal** | Production | Real | Existing; not managed from these repositories |
| (old Tokyo project) | `ahclyplubhkhggonkfnj` | Outside In Development | Tokyo | None (created automatically, empty) | — | None | Paused 17 Nov 2026; can be deleted |
| ~~`accounts-dev`~~ | ~~`xmqivpwwdksahxkkamgm`~~ | Outside In Development | Sydney | — | — | — | **Deleted 19 Nov 2026**: it had been given Reel Deal's schema by mistake (`decisions.md`) |

Findable runs on its own infrastructure (`anigemmill/Tourism-AI-Growth-Platform`), not on these
Supabase projects.

Staging: none yet for any product. If one is added, it gets its own project, its own row here and its
own `staging` entry in each product's `config/database-targets.json`; never a shared project.

### `accounts-dev` Auth settings (set in the dashboard; the database tools cannot change them)

From `docs/identity-architecture.md` §6 step 1, matching `scripts/auth-local.ts`:

| Setting | Value |
|---|---|
| JWT signing keys | Asymmetric (ES256 or RS256) as the current key; legacy HS256 secret not used by products |
| OAuth 2.1 server | On; authorisation path `/oauth/consent` |
| Site URL | `http://localhost:3100` until the account pages are deployed |
| Redirect URLs | `http://localhost:3100/**` and the local test client `http://localhost:4555/**` |
| Email provider | On; sign-ups allowed; **Confirm email on** |
| Magic link | On (part of the email provider) |
| Minimum password length | 12 |
| Refresh token rotation | On |
| MFA (TOTP) | Enrolment and verification on |
| Access token lifetime (JWT expiry) | 900 seconds |
| Other providers (Google, Microsoft, phone, anonymous) | Off for now |
