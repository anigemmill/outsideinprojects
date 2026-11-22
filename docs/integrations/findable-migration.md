# Findable: migration plan

Status: **plan only, 22 Nov 2026. Nothing has been executed.** Findable is the highest-risk change in
the ecosystem: it is live on `app.theoutsidein.nz` with pilot operators (including Te Puia), Google
connections and emailed account links. Every phase below needs separate owner approval, a quiet time
agreed with Te Puia, and a tested rollback.

Source of every fact about Findable: `anigemmill/Tourism-AI-Growth-Platform` at `5152c7f`
(23 Nov 2026), read-only.

## 1. Three phases, in this order

| Phase | What | Why this order |
|---|---|---|
| **A. Address move** | Findable's app moves from `app.theoutsidein.nz` to `findable.theoutsidein.nz`; same code, database and sign-in | Frees `app.theoutsidein.nz` (D1). Independent of the account service, so it can be done and verified on its own |
| **B. `app.theoutsidein.nz` handover** | The account app takes `app.theoutsidein.nz`, with permanent redirects for Findable's old links | The account service needs its production host before any product can use it in production |
| **C. Shared sign-in** | Findable's people and businesses move to the account service; its own sign-in is retired after a fallback week | Needs the account service live in production (B) and proven with Command Centre |

**Dependency to note:** production use of the account service by *any* product (Command Centre
included) needs phase B, which needs phase A. If phase A is delayed, the alternative is a temporary
account-app host, which costs a later host change.

## 2. Phase A: address move to `findable.theoutsidein.nz`

### 2.1 Everything that depends on the address (Verified in code)

| Dependency | Where | What changes |
|---|---|---|
| `APP_URL` (Vercel Production) | Used for every emailed link (`src/lib/auth/flows.ts`, `src/lib/email.ts`: invitation, password reset, email confirmation, welcome pack, privacy notice), the intelligence worker's hand-off to itself (`src/lib/intelligence/worker.ts`), alert emails, and every OAuth redirect URI | Set to `https://findable.theoutsidein.nz`. Findable refuses to send links if it is missing or not a bare https origin (`appUrlProblem`) |
| Google OAuth client (client-managed GA4) | Redirect URI `${APP_URL}/api/integrations/google/callback` (`src/lib/integrations/google.ts`) | Add `https://findable.theoutsidein.nz/api/integrations/google/callback` in Google Cloud **before** the switch; keep the old one until phase B |
| Google OAuth client (Search Console and GA4 for staff) | `${APP_URL}/api/intelligence/search-console/callback` (`src/lib/intelligence/search-console.ts`) | Same: add the new URI first |
| Google OAuth verification (in progress) | Authorised domain `theoutsidein.nz` (covers subdomains); homepage `theoutsidein.nz/findable/` | Homepage and domain unchanged. **Check in Google Cloud** whether adding redirect URIs during review affects it; if in doubt, do phase A after verification completes |
| Meta app | `${APP_URL}/api/integrations/meta/callback` (`src/lib/integrations/meta.ts`) | Add the new valid OAuth redirect URI first; keep the old |
| Existing Google and Meta connections | Refresh tokens stored encrypted (`FINDABLE_ENCRYPTION_KEY`); not tied to the redirect URI after connection | No change expected; **verify with one sync per provider** after the switch |
| Sessions | Cookie `gos_session`, host-only on `app.theoutsidein.nz`, 14 days (`src/lib/auth/tokens.ts`, `session.ts`) | Cookies don't follow a new host: **everyone signs in once more**. TOTP and passwords unchanged |
| In-flight OAuth connections | Attempt cookie scoped to the callback path on the old host | Switch at a quiet time; anyone mid-connection retries |
| Emailed links already sent | Invitations (7 days), resets (1 hour) point at `app.theoutsidein.nz` | `app.theoutsidein.nz` keeps serving Findable (both domains attached) until phase B; then old paths redirect |
| Vercel crons | Relative paths in `vercel.json` | None |
| Stripe webhook | `{APP_URL}/api/webhooks/stripe`, currently off (503), test mode | If ever turned on before the move, add the new URL in Stripe first |
| Website "Sign in" links | `findableAppUrl` in `anigemmill/outside-in-website` (`src/config/site.ts`, `PUBLIC_FINDABLE_APP_URL`) | Point at `https://findable.theoutsidein.nz`; deploy after the switch |
| Findable docs, pilot guides, agreements | Many mention `app.theoutsidein.nz` | Update in the same release |
| Production database | Supabase `hescoabpcjukmgeopjnq` | **Unchanged** |

### 2.2 Steps (each an owner action or owner-approved)

1. **Rehearse on a Preview deployment** with `APP_URL` set to its own address: invitation, reset,
   confirmation, Google and Meta connect (test accounts), worker hand-off, alert email. Record results.
2. **DNS (owner, Freeparking):** CNAME `findable` → Vercel. No other DNS change.
3. **Vercel, project `tourism-ai-growth-platform`:** add `findable.theoutsidein.nz`; keep
   `app.theoutsidein.nz` attached.
4. **Google Cloud and Meta:** add the new redirect URIs (old ones stay).
5. **Agree a quiet time with Te Puia**; tell pilot users they will sign in once more and where.
6. **Switch:** set Production `APP_URL` to `https://findable.theoutsidein.nz`, redeploy (no migration
   in this release).
7. **Website:** point Sign in links at the new address; deploy.
8. **Validate in production** (§2.4).
9. **Keep both addresses** until phase B.

### 2.3 Rollback

Set `APP_URL` back to `https://app.theoutsidein.nz` and redeploy (Vercel's instant rollback also
works, because nothing else changed). Both domains and both sets of redirect URIs stay registered, so
rollback needs no DNS or Google change. Sessions created on the new host are lost (sign in again).

### 2.4 Production validation

| Check | Pass |
|---|---|
| `https://findable.theoutsidein.nz/login` loads over https | ✔ |
| A staff member and a test operator sign in (with TOTP where enrolled) | ✔ |
| Invitation and reset emails link to the new host and work | ✔ |
| Google GA4 and Search Console: an existing connection syncs; a test connect completes | ✔ |
| Meta: an existing connection syncs | ✔ |
| Intelligence worker hand-off and the nightly crons run | ✔ |
| `app.theoutsidein.nz` still serves Findable | ✔ |
| Error monitoring and alerts show no new failures for 24 h | ✔ |

## 3. Phase B: `app.theoutsidein.nz` becomes the account app

Prerequisites: account service production (`accounts-prod`, paid: **cost approval**), the account
app deployed, Command Centre integration verified in development.

1. Deploy the account app to its production Vercel project with `app.theoutsidein.nz` **not yet**
   attached; test on its own address.
2. Move the domain `app.theoutsidein.nz` from Findable's Vercel project to the account app's.
3. The account app serves **permanent redirects (308, path and query preserved)** for Findable's old
   paths to `findable.theoutsidein.nz`: the emailed-link paths `/invite`, `/reset-password` and
   `/verify-email` (`src/lib/auth/flows.ts`), `/login`, `/forgot-password`, `/two-factor`, `/portal/*`,
   `/api/integrations/google/callback`, `/api/intelligence/search-console/callback`,
   `/api/integrations/meta/callback`, plus a catch-all for every other Findable path that the account
   app does not use itself, kept for at least 6 months.
4. Remove the old redirect URIs from Google and Meta only after a month without traffic on them.
5. Rollback: move the domain back to Findable's project (Findable still works on both hosts).

## 4. Phase C: Findable joins the shared sign-in

### 4.1 People and organisations

| Findable today | Becomes |
|---|---|
| Each business (`Operator`/`Business`) | An organisation in the account service, **same id where possible**, otherwise a recorded mapping |
| `UserBusiness` links | Memberships; `isPrimaryContact` → the organisation's billing contact |
| `OPERATOR` users | Members (`owner` for the primary contact, `member` otherwise) with Findable product access |
| `FOUNDER`, `ADMIN`, `PROGRAMME_MANAGER`, `ANALYST` | **Platform staff** in the account service (not organisation members); Findable keeps its staff permission catalogue keyed by user id |
| Findable roles and per-user permissions for operators | Stay in Findable, keyed by account user id |
| Passwords (scrypt) | Not imported (Supabase Auth import of scrypt hashes is **unverified**); each person sets a password through an emailed link |
| TOTP factors | Re-enrolled on the account app (secrets are not transferable) |
| Sessions | Ended; everyone signs in on the account app |
| Support view (`SupportView`) | Moves to the account service's audited staff support sessions (A8) |
| Stripe (test mode, per business) | Stays in Findable until billing moves to the account service (step 10); **do not start live billing in Findable before then**, or billing must migrate too |

### 4.2 Steps

1. **Findable code (in its repository, approved separately):** OIDC client with the shared verifier,
   account mirrors, `findable` product access and entitlements, staff from the account service's
   platform-staff list; its own sign-in kept behind a switch.
2. **Staging rehearsal:** a copy of production data in Findable's staging project (its staging
   safeguards already refuse production), imported into `accounts-dev`; full sign-in, invitation, MFA
   and permission tests; record timings.
3. **Import to `accounts-prod`:** organisations, people, memberships, platform staff; emailed "set your
   password" links; Te Puia contacted first.
4. **Switch** Findable to the shared sign-in at the agreed quiet time; keep the old sign-in available
   for **one week** as a fallback (decided 17 Nov), then remove it.
5. **Rollback** (during the fallback week): turn the switch back; Findable's own `User` table is
   untouched until the old sign-in is removed.

### 4.3 Validation

Every pilot user signs in on the account app and reaches only their business; staff reach the back
office and the support view is audited; removing a membership blocks access within a minute; Google
and Meta connections still sync; no operator sees another business (isolation tests on production
data shapes in staging).

## 5. Risks

| Risk | Mitigation |
|---|---|
| Disrupting Te Puia during the pilot | Quiet times agreed in advance; each phase small and reversible; Te Puia told first |
| Google OAuth verification affected | Add, never replace, redirect URIs; check in Google Cloud before phase A, or wait for verification |
| Emailed links break | Both hosts serve Findable until B; 308 redirects for 6 months after |
| Password reset friction in phase C | Clear emails; staff help on the day; fallback week |
| Duplicate people (same email elsewhere) | Merge only by verified email after sign-in, never silently |
