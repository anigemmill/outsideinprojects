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
