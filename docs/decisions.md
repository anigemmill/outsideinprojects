# Decisions

Newest last. Ecosystem-wide decisions live in `anigemmill/commandcentre` `docs/decisions.md`; this file
records the ones that shape this service.

## 2026-11-16 to 2026-11-17 (from the owner)

- **One account for every product.** People sign in once; organisations add products by subscribing.
- **Separate product databases.** This service owns identity, organisations, access and billing only;
  products mirror what they need through signed events.
- **Billing.** One Stripe customer per organisation. A bundle is one subscription and one bill; a single
  product is its own subscription.
- **Billing rules (from Findable, decided 3 Nov 2026):** downgrades at the end of the billing period;
  upgrades take effect only once the upgrade invoice is paid; failed payments keep the plan while Stripe
  retries, then pause; only the organisation's billing contact can pay; usage allowances reset on the
  1st, New Zealand time; manual and provider-confirmed records kept separate.
- **Hosting in Sydney** for all data.
- **Findable moves early**, while it has one live business, after this service is built and tested with
  Command Centre.
- **Repository:** `anigemmill/outsideinprojects`.

## 2026-11-17: shared identity and the development project (approved by the owner, 17 Nov 2026)

- **This service is the central identity service.** Its Supabase Auth (one project per environment)
  is the only customer sign-in for Command Centre, Findable and Reel Deal, through Supabase's OAuth 2.1
  / OpenID Connect server. Products keep separate databases and lock their own Supabase Auth.
  Full design: `docs/identity-architecture.md`. Variables and secrets: `docs/environments.md`.
- **OAuth 2.1 server is in beta**, free on all plans during the beta. Products use only standard OIDC so
  the provider can be replaced; fallback keeps one identity (`identity-architecture.md` §7).
- **Cost of a development project** (checked 17 Nov 2026 against Supabase's billing docs and the ANI
  organisation, which is on Pro, billed through Vercel, with three active projects already):
  a fourth project in ANI adds about **US$10 a month** of compute (Micro, US$0.01344 an hour, billed
  hourly; the US$10 monthly compute credit is already used by the existing projects; compute is not
  covered by the spend cap). A project in a separate **Free** organisation costs **US$0**, pauses after
  7 days of low activity (restorable) and has no automated backups, which is acceptable for synthetic data.
- **Recommendation:** a separate free organisation for development ("Outside In Development"), so
  development is separated from production by organisation, billing and team, not just by project.
  The paid project in ANI is the fallback if the free quota is not available.
- **Approved: Option A.** The owner is creating a free Supabase organisation for development.
  `accounts-dev` (Sydney) is created there only after its quoted cost is confirmed as US$0.

## 2026-11-17: A2 implementation choices

- **Server-only Supabase calls.** The account pages call Supabase Auth only from server actions and
  routes; the session lives in httpOnly cookies on the account domain. So the settings are
  `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`, read at start-up, not `NEXT_PUBLIC_` values baked in
  at build time; one build runs in any environment.
- **Verified identity on every request:** `getClaims()` (checks the token's signature with the signing
  keys), never the unchecked session in the cookie.
- **Local compatibility files are applied once and recorded**, like migrations. A bug where re-running
  them re-granted default table privileges after the foundation migration had removed them was caught
  by the database tests and fixed before commit; only `02_auth_grants.always.sql` (no default grants)
  re-runs.
- **Local Supabase Auth** is the official release binary, pinned by version and SHA-256 (Supabase
  publishes no checksums, so the hash pins the file that was reviewed). Not used in CI.

## 2026-11-19: `accounts-dev` rebuilt; migration target guard (approved by the owner)

- **Incident.** On 17 Nov the first `accounts-dev` (`xmqivpwwdksahxkkamgm`) was created from a Reel
  Deal session, which then applied Reel Deal's eight migrations to it, taking it for a Reel Deal test
  project. No data was written and no Auth setting was changed. Root cause: nothing in any product's
  migration tooling checked which database it was pointed at.
- **Rebuilt.** The owner deleted that project. A new `accounts-dev` (`egtlqrmujhxelczbyszj`, Outside
  In Development, Sydney, US$0) was created on 19 Nov with only this service's foundation migration
  and its identity marker. Auth settings are set by the owner in the dashboard (`environments.md`),
  because the database tools cannot change them.
- **Migration target guard** in all three repositories (`src/server/db/migration-target.ts`, shared
  verbatim): each product lists its Supabase project per environment in `config/database-targets.json`;
  runners refuse unlisted projects, unverifiable hosts and databases carrying another product's meta
  schema or identity marker (a comment on the product's own meta schema); a missing marker is recorded
  on the first verified run. Fails closed; no override switch. Reel Deal's change is limited to its
  two command-line runners.
- **Development environment cleaned up.** The cloud environment used for this work now allows only
  the new `accounts-dev` among Supabase hosts; the deleted project and Reel Deal's production project
  were removed from it, so development sessions cannot reach production.
- **Account schema proposed** for review before any migration: `docs/schema-proposal.md` (A3–A4).

## 2026-11-21: Auth configuration and the OAuth server (approved by the owner)

- **Supabase Auth vs the OAuth 2.1 server.** Supabase Auth is this service's authentication
  provider (users, passwords, MFA, sessions): required. The OAuth 2.1 server additionally makes this
  project an OpenID Connect provider for other applications. It is **required for the approved
  architecture**: one login across separately hosted products, with each product holding only its
  own revocable tokens, needs a standard redirect protocol, and building one ourselves would be
  custom auth. It is not needed for the account pages or the A3–A4 schema.
- **Timing.** The OAuth server stays **off in `accounts-dev` until A2 step 3** (the first end-to-end
  test with a product client), then on with authorisation path `/oauth/consent` and dynamic client
  registration off. On in `accounts-prod` before Command Centre's first deployment.
- **Approved Auth configuration** for development and production: `environments.md`.
- **Finding: products check `client_id`, not `aud`.** Supabase's OAuth access tokens identify the
  client in a `client_id` claim; `aud` stays generic unless a Custom Access Token Hook rewrites it.
  Our design had products checking `aud`. Corrected in `identity-architecture.md` §2 and `spec.md` §4:
  each product verifies `client_id` equals its own client id for the environment, and refuses tokens
  without one (e.g. the account pages' own sessions). To be confirmed against a real token in A2
  step 3. Command Centre's copies of the identity spec point here as the master.
- **Open:** will all products live under one domain? The OAuth server is recommended either way, and
  is the only workable route if any product keeps its own domain.
