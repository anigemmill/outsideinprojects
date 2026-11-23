# Security review: the shared identity foundation

Date: 22 November 2026. Scope: the account service and how products trust it
(`identity-architecture.md`). Purpose: settle every control **before** account-service implementation
goes further, so nothing is built on an unchecked assumption.

**This review is complete as a design review. It is not a verification.** Each control below is
marked:

| Status | Meaning |
|---|---|
| **Verified** | Proven by a test or observed on a live system (date given) |
| **Built** | Code exists and has unit tests, not yet proven end to end |
| **Designed** | Agreed here; to build, with the test named |
| **Open** | Needs a real-token check or an owner decision before it is final |

The gate: **no product (Command Centre first) integrates until every row in §1–§4 is Verified.**

## 1. Tokens

### 1.1 Validation in every product (shared verifier)

| Control | Rule | Test | Status |
|---|---|---|---|
| Signature | Verify with the account project's JWKS (from the discovery document), cached, re-fetched once on an unknown `kid` | Valid token passes; tampered payload, wrong key and unknown `kid` after re-fetch fail | Designed |
| Algorithm allow-list | **ES256 only** (RS256 added only if the project moves to it). Refuse `none`, every `HS*`, and any algorithm the header names that is not on the list; never let the header choose the key type | `alg: none`, HS256 signed with the public key bytes, RS/ES confusion all fail | Designed. ES256 key **Verified** in `accounts-dev` JWKS (21 Nov; again 23 Nov on the current project) |
| Issuer | `iss` exactly equals the environment's issuer, e.g. `https://urdrrzqqtmeuwlxksuov.supabase.co/auth/v1` | Production token in development and vice versa fail | Designed. Issuer string **Verified** (23 Nov) |
| Client | `client_id` exactly equals this product's client id in this environment; missing `client_id` fails | Another product's token, the account pages' own token, and a token with no `client_id` fail | Designed (**Decided** 21 Nov). Claim presence **Open**: real token in A2 step 3 |
| Audience | Not used to tell products apart. Record its real value; if a hook later sets it per product, check both | — | **Open** (real value unknown) |
| Expiry | `exp` in the future; `iat`/`nbf` not in the future; ≤ 60 s skew | Expired, not-yet-valid and far-future `iat` fail | Designed. 900 s lifetime **Open** |
| Subject | `sub` is a UUID; it is the only claim used for authorisation | Non-UUID `sub` fails | Designed |
| Transport | Tokens only from the product's own session cookie or a server `Authorization` header; never from URLs or browser storage | Token in a query string is ignored | Designed |

### 1.2 Refresh

| Control | Rule | Status |
|---|---|---|
| Where | Refresh only server-side, by the product's server, with its client credentials | Designed |
| Rotation | Each refresh returns a new refresh token; the old one stops working; reuse of an old one revokes the session | Rotation **on** in the approved settings; behaviour **Open** (A2 step 3) |
| Failure | A failed refresh ends the product session (sign in again); never extends an expired token | Designed |

### 1.3 Revocation and sign-out

| Event | Effect | Bound on stale access | Status |
|---|---|---|---|
| Product sign-out | Product clears its cookie and revokes its own refresh token | Immediate for that product | Designed (**Decided** D6) |
| Global sign-out ("sign out everywhere") | Account session ended; all refresh tokens revoked; `session.revoked` event to every product; products delete that person's sessions | Up to 15 min on an access token already issued, unless the product has processed the event (then immediate) | Built (account pages call global sign-out); whether OAuth clients' refresh tokens are revoked **Open** |
| Password change or reset | Treated as global sign-out | Same | Designed |
| Removed from organisation | `membership.removed` event; product refuses that organisation on the next request | Seconds (event latency), whatever the token says | Designed |
| Product access removed | `product_access.changed` event; product refuses | Seconds | Designed |
| Suspended person or organisation | Event; product refuses everything for them | Seconds | Designed |

Products check a local **session revocation list** (fed by `session.revoked`) on every request, so a
processed revocation takes effect before the access token expires.

## 2. Sign-in, sessions and redirects

| Control | Rule | Status |
|---|---|---|
| Account session | Supabase Auth cookies on the account app's origin only, httpOnly, `SameSite=Lax`, Secure in production; never sent to a product (separate origins, **Decided** D2) | Built (`src/lib/supabase/server.ts`, `src/proxy.ts`) |
| Verified identity on account pages | `getClaims()` (signature and expiry checked), never the unverified cookie | Built |
| MFA before account pages and before approving a product | Required when a factor is enrolled. **Fails closed** if the level can't be determined | Built; fail-closed fixed 22 Nov (`src/lib/auth/assurance.ts`, tests) |
| First-party consent | Only client ids in `FIRST_PARTY_CLIENT_IDS` are approved without a prompt | Built (`src/lib/auth/consent.ts`, tests) |
| After-sign-in redirect | Same-site relative paths only | Built (`src/lib/auth/redirects.ts`, tests) |
| OAuth `redirect_uri` | Exact registered URLs per client per environment; dynamic registration off | Settings approved; exact matching **Open** |
| `state` and `nonce` | Product generates both per sign-in, binds `state` to the browser (short-lived httpOnly cookie), checks both on return | Designed |
| PKCE | S256 only | Designed |
| Product session | Encrypted httpOnly, Secure, host-only cookie on the product's origin; contains that product's tokens only | Designed |
| CSRF | Products keep origin checks on state-changing requests (same-site subdomains are not protected by `SameSite`) | Designed (Next.js server actions do this) |
| Session policy | Inactivity timeout and MFA requirements | **Open** (D7: to review before implementing) |

## 3. Database access, RLS and isolation

| Control | Rule | Status |
|---|---|---|
| Deny by default | No default privileges for `anon`/`authenticated` on new objects; nobody creates in `public` | **Verified** on `accounts-dev` (19 Nov) and in database tests |
| RLS on every table | Tests fail if any `public` table lacks RLS or a policy | Built (guard view); **Verified** empty on `accounts-dev` |
| Account Data API exposure | Supabase accepts OAuth access tokens on the account project's own Data API (with RLS). So: no customer writes through the Data API; reads limited to the person's own rows; tables that products have no reason to read are not exposed. **Decision in A3:** remove `public` from exposed schemas if the account pages don't need it (they call Supabase Auth and the database from their server, so they likely don't) | Designed; **Open** (A3) |
| Server writes | A restricted runtime role (no `BYPASSRLS`, no `CREATEROLE`, column-level grants), never the service role; the secret key only in audited admin code | Designed (Reel Deal's `reeldeal_web` pattern) |
| Migration target | Runners refuse another product's database or an unlisted project; identity marker | **Verified** (tests, 19–21 Nov; marker on `accounts-dev`) |
| Product isolation | Separate databases per product; products never hold another product's secrets, database URLs or tokens | **Decided**; environment separation **Verified** for the cloud development environment (19 Nov) |
| Organisation isolation | Every customer row carries `org_id`; policies check membership; composite foreign keys; isolation tests generated per table | Designed (A3) |

## 4. Organisations, memberships, entitlements and events

| Control | Rule | Status |
|---|---|---|
| Last owner | An organisation always has an active owner; demoting or removing the last one fails (constraint trigger, serialisable transaction) | Designed (A3) |
| Role changes | Only owner/admin; admins cannot change owners; nobody changes their own role | Designed (A3) |
| Invitations | Hashed single-use tokens, 7-day expiry, email must match on acceptance, seat limit checked twice, audited | Designed (A3) |
| Agency delegation | Client owner accepts; ending the relationship removes every delegated membership in one transaction | Designed (later) |
| Entitlements | Computed by the account service from subscriptions; never written by customers or products; products enforce in their service layer | Designed (A4) |
| Event signing | Each product has its own secret; HMAC-SHA256 over `timestamp.body`; reject if older than 5 minutes or replayed (event id seen) | Designed (A6) |
| Ordering | Per-organisation sequence numbers; a product holds an event after a gap and fetches the organisation's current state | Designed (A6) |
| Delivery and retries | Outbox written in the same transaction as the change; delivery with exponential backoff for 24 h; dead-letter list; alert after 5 minutes of lag | Designed (A6) |
| Reconciliation | Nightly comparison of each product's mirror with the source; repairs drift; alerts on any difference | Designed (A6) |
| Stale mirror | A product that has not received an event for an organisation for longer than its reconciliation window keeps serving reads but refuses permission-raising changes until reconciled **[to confirm in A6]** | Designed |

## 5. Findings from this review

| # | Finding | Action | Status |
|---|---|---|---|
| F1 | `requireUser()` skipped MFA if the assurance-level check returned an error (fail open), on the path that approves product sign-ins | Fail closed; pure rule with tests | **Fixed** 22 Nov |
| F2 | Products must check `client_id`, not `aud` | Docs corrected | **Fixed** (docs) 21 Nov; verify with a real token |
| F3 | OAuth tokens work on the account project's Data API | RLS assumption recorded; exposure decision in A3 | Open |
| F4 | The discovery document advertises ID-token algorithms `RS256`, `HS256`, `ES256` (**Verified** 23 Nov) | Allow-list in the verifier; never trust the header | Designed |
| F5 | Global sign-out may not revoke OAuth clients' refresh tokens | Revocation list fed by events, regardless; verify in A2 step 3 | Open |
| F6 | Reel Deal's app currently shares the `theoutsidein.nz` origin with the website | Moves to `reeldeal.theoutsidein.nz` when it joins (**Decided** D3) | Planned |

## 6. What "verified token behaviour" means (A2 step 3 acceptance)

With the OAuth server on in `accounts-dev` (owner approval) and a registered test client:

1. Complete a sign-in through `/oauth/consent`; capture the access, refresh and ID tokens in the test
   (never logged).
2. Record the real header and claims (`alg`, `kid`, `iss`, `aud`, `client_id`, `sub`, `role`, `exp`,
   `iat`, `amr`/`aal`, `session_id`) in `identity-architecture.md` §6.1.
3. Prove each rule in §1.1 with the shared verifier against those tokens, including rejection cases.
4. Prove refresh rotation and reuse rejection; prove product sign-out revokes the product's refresh
   token; prove whether global sign-out revokes it.
5. Prove `redirect_uri` exact matching (an unregistered URL, a different path and a wildcard all fail).
6. Prove an MFA-enrolled person can't reach consent with a password only.
