# Build plan (ecosystem roadmap)

**Revised 22 Nov 2026 to the owner's order**, with the dependency changes noted below. Each step ends
tested and reviewed before the next starts. Step names A1–A9 from the earlier plan are kept in brackets
so existing references still resolve. This is milestone M2a in Command Centre's plan
(`anigemmill/commandcentre` `docs/specs/11-milestones.md`).

| # | Step | Includes | Done when | Status |
|---|---|---|---|---|
| — | Foundations (A1) | Next.js, CI, migrations, environment checks, migration target guard | CI green; guard tested | ✅ 17–21 Nov |
| 1 | **Security review and authentication foundation** (A2, part) | `security-review.md`; account pages; approved `accounts-dev` Auth settings entered (owner, dashboard) | Review complete; settings confirmed | 🟡 Review complete 22 Nov (one fail-open fixed); settings **not yet entered** |
| 2 | **Verified token behaviour and shared token verifier** (A2 step 3, A5 part) | OAuth server on in `accounts-dev` (**approval**), test client, real tokens captured and recorded, shared verifier in the foundation package | Every row of `security-review.md` §1 and §6 is Verified | Not started |
| 3 | **Core account schema** (A3 part) | Profiles, platform staff, products table, audit events, restricted runtime role; Data API exposure decided | Isolation and privilege tests pass | Proposed (`schema-proposal.md`) |
| 4 | **Organisations and memberships** (A3) | Organisations, memberships, last-owner rule, invitations | An owner invites a teammate who joins; isolation tests pass | Not started |
| 5 | **Product registry, entitlements and events** (A4, A6) | Products and clients per environment, product access, staff-assigned subscriptions, entitlements; **outbox, signed delivery, ordering, retries, reconciliation, revocation events** | A removed member is blocked in a test product within a minute; a dropped event is repaired | Not started |
| 6 | **Account UI and product launcher** (A7) | Organisation choice, launcher, members and invitations pages, shared product switcher | Works in light and dark, keyboard and screen reader | Not started |
| 7 | **Command Centre integration** (Command Centre M2b) | `integrations/command-centre.md` | Exit criteria there met in development | Plan ready; local-issuer part can start after step 2 |
| 8 | **Reel Deal: preparation now, integration after 7** | `integrations/reel-deal.md` | Reel Deal signs in through the account service in development | Preparation applies now (D4) |
| 9 | **Findable migration** | `integrations/findable-migration.md`: A address move, B `app.theoutsidein.nz` handover, C shared sign-in | Each phase validated in production | Plan ready; nothing executed |
| 10 | **Billing and commercial account management** (A9) | Stripe in the account service, Findable's billing rules | Test-mode changes flow to entitlements in each product | Not started |
| — | Platform staff and support access (A8) | Time-limited, audited support sessions | Needed before Findable phase C (Findable's support view moves here) | Not started |

### Dependency review of the order

1. **Events join step 5.** Command Centre's integration (7) depends on mirrors, and permission
   revocation and global sign-out depend on events. Delivering events after the integration would mean
   integrating twice.
2. **Step 6 can overlap step 7.** Command Centre's development integration needs sign-in, organisations,
   product access and events, not the launcher; the launcher is needed before production.
3. **Command Centre work can start early.** Its sign-in, session, mirror and isolation code can be built
   against a local test issuer once step 2 has fixed the token rules.
4. **A production step is missing from the list and is added before 9:** `accounts-prod` (paid
   organisation, **cost approval**), the account app's production deployment and Command Centre's
   production host. Findable's phase B needs it.
5. **Findable phase A (address move) is on the critical path** for any production use of the account
   service, because the account app's production host is `app.theoutsidein.nz` (D1). It is independent
   of the account service technically, so it can be rehearsed early and executed when phase B is near.
6. **Platform staff (A8) must precede Findable phase C**, because Findable's staff accounts become
   platform staff and its support view moves here.
7. **Billing (10) stays last**, on one condition: Findable must not start live billing on its own Stripe
   before then, or billing becomes a second migration.

## Previous "then" list (superseded by steps 7–9 above)

1. Command Centre signs in through this service (Command Centre M2b).
2. Findable: staging copy moved onto this service and tested, then production switched at a time agreed
   with Te Puia, with the old sign-in kept for a week as a fallback (`spec.md` §7).
3. Reel Deal moved onto this service (`spec.md` §7).

## A2 progress (17 Nov 2026)

Built and checked without a running Supabase Auth:

- Pages: sign in (password or emailed link), create account, check your email, forgot and reset
  password, two-step sign-in (TOTP) challenge, account, security (set up and remove an authenticator
  app), sign out and sign out everywhere, and the OAuth consent page that products are sent to.
- Email-link landing routes for both Supabase link styles (`/auth/callback`, `/auth/confirm`).
- Rules in code and tested: same message whether or not an account exists; only same-site redirects
  after sign-in; MFA completed before account pages or approving a product; first-party products
  approved without a prompt, any other client asked; honest message when Auth is unreachable.
- Local Supabase Auth runner (`npm run auth:local`), written but not yet run in the build environment.

Still to do for A2: run the full flow against real Supabase Auth (blocked until `accounts-dev` exists
or the local runner is allowed to run), end-to-end tests of sign-up, email confirmation, MFA and the
OAuth flow with a test product client, and Google/Microsoft sign-in.
