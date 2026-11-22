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
| `APP_URL` | No | Public URL of the account pages | `http://localhost:3100` | dev URL | `https://app.theoutsidein.nz` (proposed, `identity-architecture.md` §12 D1; alternative `https://account.theoutsidein.nz`) |
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
| `reeldeal` | `jzshbaqfrrgsyiciuzfe` | (Reel Deal's organisation) | Sydney | **Reel Deal** | Production | Real (0 users; sign-in not open, 22 Nov 2026) | Existing; not managed from these repositories |
| Findable production | `hescoabpcjukmgeopjnq` | ANI | Sydney | **Findable** (database only, through Prisma; Findable does not use Supabase Auth) | Production | Real (pilot operators) | Existing; serves `app.theoutsidein.nz`; not managed from these repositories |
| (old Tokyo project) | `ahclyplubhkhggonkfnj` | Outside In Development | Tokyo | None (created automatically, empty) | — | None | Paused 17 Nov 2026; can be deleted |
| ~~`accounts-dev`~~ | ~~`xmqivpwwdksahxkkamgm`~~ | Outside In Development | Sydney | — | — | — | **Deleted 19 Nov 2026**: it had been given Reel Deal's schema by mistake (`decisions.md`) |

Findable (`anigemmill/Tourism-AI-Growth-Platform`) also has a staging Supabase project of its own
(its `docs/STAGING.md`). Live addresses for every product: `identity-architecture.md` §2.1.

Staging: none yet for any product. If one is added, it gets its own project, its own row here and its
own `staging` entry in each product's `config/database-targets.json`; never a shared project.

### `accounts-dev` Auth settings (set in the dashboard; the database tools cannot change them)

**Approved by the owner, 21 Nov 2026** (`decisions.md`). Based on `identity-architecture.md` §6 step 1
and `scripts/auth-local.ts`. Development values are set in `accounts-dev` now; production values are
the plan for `accounts-prod`.

| Area | Setting | Development (`accounts-dev`) | Production (`accounts-prod`, later) |
|---|---|---|---|
| Sign-up | New sign-ups | On | On |
| | Anonymous sign-ins, manual identity linking | Off | Off |
| | CAPTCHA | Off | On: Cloudflare Turnstile (free) [CONFIRM] |
| Email | Email provider, magic link / email OTP | On | On |
| | Confirm email | **On** | **On** |
| | Secure email change (both addresses confirm) | On | On |
| | Sender | Supabase built-in mailer (reaches only the Supabase organisation's members) | Custom SMTP (Resend), branded templates |
| Passwords | Minimum length | **12** | **12** |
| | Required character types | None (length over complexity) | None |
| | Leaked password protection | Not on the free plan | On (paid plan) |
| | Secure password change | Off (the account pages check the current password) | Off |
| MFA | TOTP enrolment and verification | **On** | On |
| | Phone / SMS MFA | Off | Off |
| | Max factors per user | 10 | 10 |
| | Enforcement | Not forced at sign-in; an enrolled factor must be completed before account pages or product approval; organisations that require MFA are enforced by products on sensitive actions | Same; consider requiring it for owners and admins [CONFIRM] |
| Sessions and tokens | Access token (JWT) expiry | **900 s** | 900 s |
| | Refresh token rotation; reuse interval | On; 10 s | On; 10 s |
| | Inactivity timeout, time-boxed sessions, single session per user | Off | Consider 30-day inactivity [CONFIRM]; single session off |
| JWT signing | Current key | **ES256 asymmetric** (already current; confirmed from the public JWKS, 21 Nov 2026) | ES256, generated in that project |
| | Legacy HS256 secret and legacy API keys | Present but unused by products; use the new publishable and secret keys | Disable legacy API keys once unused |
| URLs | Site URL | `http://localhost:3100` | `https://app.theoutsidein.nz` (proposed, D1) |
| | Redirect URLs (email links) | `http://localhost:3100/**`, `http://localhost:4555/**` | `https://app.theoutsidein.nz/**` only (proposed, D1) |
| OAuth 2.1 server | Enabled | **Off until A2 step 3** (first end-to-end test with a product client) | On before Command Centre's first deployment |
| | Authorisation path | `/oauth/consent` | `/oauth/consent` |
| | Dynamic client registration | **Off** | **Off** |
| | Clients | Registered by hand, confidential, PKCE: test client `http://localhost:4555/callback`; Command Centre local `http://localhost:3000/auth/callback` | One per product with production callbacks; secrets only in each host's secret store |
| | Claim products verify | `client_id` (`identity-architecture.md` §2) | `client_id` |
| Providers | Google, Microsoft | Off (need Google Cloud and Entra registrations) | On when registered |
| | Phone | Off | Off |
| Rate limits | | Supabase defaults | Review: sign-ins come from the account pages' server, so many people share few IP addresses |
