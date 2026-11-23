# The Outside In account: shared identity and product subscriptions

> Master copy. Moved here from `anigemmill/commandcentre` `docs/specs/13-accounts-and-identity.md`
> (17 Nov 2026). References like `03`, `07` or `10` point to Command Centre's specs in that repo.

Status: **decided by the owner (2026-11-16), design proposed.** One account signs a person in to every
product. An organisation adds products by subscribing to them. This replaces the earlier proposal of
separate accounts linked by OAuth.

**Architecture, domains, sessions and token validation:** `identity-architecture.md` is the single
architecture document for the ecosystem. This spec keeps the account service's requirements and data
model; where the two differ, `identity-architecture.md` and `decisions.md` win.

## 1. What the person sees

1. They create **one Outside In account** (email, Google or Microsoft) and an organisation, on the
   Outside In account app (proposed at `app.theoutsidein.nz`).
2. They subscribe the organisation to one or more products: Command Centre, Findable, Reel Deal.
3. A **product switcher** in every product's top bar lists the organisation's products. Subscribed
   products open straight away, with no second sign-in. Unsubscribed ones show "Add to your plan".
4. Teammates are invited once, to the organisation, and given access per product.
5. Billing is one place: one customer, one invoice, a line per product (resolves open question 7).

## 2. Architecture

```
             ┌────────────────── Accounts service (The Outside In) ──────────────────┐
             │  Supabase project "accounts": Auth (users, sessions, MFA, SSO)          │
             │  organisations · memberships · product access · subscriptions (Stripe)  │
             │  entitlements · invitations · audit of account changes                  │
             │  Issues signed access tokens (JWT, asymmetric keys, public JWKS)        │
             └───────────────┬──────────────────────┬──────────────────────┬──────────┘
                 events (outbox, signed)    token + JWKS            token + JWKS
                             ▼                      ▼                      ▼
               Command Centre DB            Findable DB            Reel Deal DB
               (own Postgres + RLS)         (own Postgres + RLS)   (own Postgres + RLS)
               mirror of orgs, members,     mirror …               mirror …
               product access, entitlements
```

- **Identity is central; product data is not.** Each product keeps its own database. Strategy data
  never sits next to video files or crawl data, and one product's outage or breach does not expose the
  others' data.
- **How a product trusts the account:** the product's server verifies the access token against the
  accounts service's JWKS (signature, issuer, audience, expiry). It then runs every query in a
  transaction with `set local role authenticated` and `request.jwt.claims` set to the verified claims,
  so `auth.uid()` and RLS work exactly as on Supabase. Reel Deal already runs queries this way
  (`src/server/db/postgres.ts`), so the pattern is proven in the ecosystem.
- **Single sign-on:** sign-in happens on the Outside In account app, proposed at `app.theoutsidein.nz` (`identity-architecture.md` §3, §12 D1). Products are
  OpenID Connect clients of it. A person signed in once is signed in to every product they can use;
  sign-out ends all product sessions.
- **Mirrors:** organisations, memberships, product access and entitlements are mastered in accounts and
  copied to each product's database by signed events (outbox pattern, ordered per organisation,
  idempotent). Product RLS joins the local mirror, so no request depends on a live call to accounts.
  A nightly reconciliation job compares mirrors with the source and repairs drift.
- **Product roles stay in the product.** Accounts holds organisation roles (owner, admin, member,
  billing) and which products each member can open. Each product holds its own detailed roles (Command
  Centre's Manager, Contributor, Viewer; Reel Deal's editor, viewer) keyed to the same user and
  organisation ids.

## 3. Accounts data model

| Table | Key columns |
|---|---|
| `organisations` | `id`, `name`, `kind` (`business`, `agency`, `enterprise`), `region`, `stripe_customer_id`, `status` |
| `memberships` | `org_id`, `user_id`, `org_role` (`owner`, `admin`, `member`, `billing`), `status`, `delegated_from_org_id` |
| `product_access` | `org_id`, `user_id`, `product` (`command_centre`, `findable`, `reel_deal`), `product_role` (product-defined key), `granted_by` |
| `subscriptions` | `org_id`, `product` or bundle, `plan_key`, `status`, `period_start`, `period_end`, `stripe_subscription_id` |
| `entitlements` | `org_id`, `product`, `key`, `value`, `source`, `valid_until` |
| `invitations` | `org_id`, `email_hash`, `org_role`, `products jsonb`, `token_hash`, `expires_at` |
| `org_relationships` | agency ↔ client links (`03` §3) |
| `outbox_events` | `id`, `org_id`, `seq`, `type`, `payload`, `published_at` |
| `account_audit_events` | sign-ins, MFA changes, role and access changes, subscription changes |

Workspaces and brands **stay in Command Centre** (and Reel Deal keeps its own brand profiles), because
they are product data. Shared business context still flows through the `07` context API.

## 4. Token claims

Target claims. With Supabase's OAuth 2.1 server, the product is identified by `client_id` (its OAuth
client id), not `aud`, which stays generic unless a Custom Access Token Hook sets it. Products verify
`client_id` (`identity-architecture.md` §2). `org`, `org_role` and `products` need that hook too.
The `aud` value shown is Supabase's default for signed-in users; confirm it against a real token in
A2 step 3.

```json
{
  "iss": "https://<accounts project>.supabase.co/auth/v1",
  "sub": "<user id>",
  "client_id": "<Command Centre's OAuth client id>",
  "aud": "authenticated",
  "org": "<active organisation id>",
  "org_role": "admin",
  "products": ["command_centre", "reel_deal"],
  "amr": ["pwd", "totp"],
  "exp": 1763300000
}
```

Claims are hints for routing and UI. Authorisation always uses the local mirror (so removing someone
takes effect as soon as the event lands, typically seconds, not at token expiry). Access tokens last 15
minutes; refresh is handled by the accounts session.

## 5. Product-to-product calls

With one account, Command Centre calls Reel Deal and Findable **as the signed-in user** (token
exchange, RFC 8693, audience switched to the target product) or, for background agent work, as a
service principal of the organisation with `on_behalf_of`. There is no separate "connect Reel Deal"
OAuth consent step: subscribing to Reel Deal is the connection. An admin can still turn the data
exchange off per organisation.

## 6. Entitlement checks

- Product entry: a product refuses an organisation without an active subscription to it
  (`product_access` and `subscriptions` mirrors), showing "Add [product] to your plan" with a link to
  accounts billing.
- Features and limits: `requireEntitlement(ctx, key)` in each product's service layer, against its
  entitlement mirror (`10`).
- Downgrade or cancellation: the product becomes read-only for 30 days [CONFIRM], then locked. Data is
  kept until the organisation is closed or the owner asks for deletion.

## 7. Migration impact on Reel Deal

Reel Deal today has its own Supabase Auth, organisations and memberships. Moving it onto the shared
account means:

1. Its server accepts accounts-issued tokens (it already has a JWKS verifier for MCP OAuth).
2. Its `organisations` and `memberships` become mirrors fed by account events, keyed by the same ids.
3. Existing users and organisations are imported into accounts once, with ids preserved.
4. Its credit ledger and plan config remain in Reel Deal; the plan *assignment* comes from accounts.

This is Reel Deal work, scheduled with Command Centre's M2 (`11`). Nothing in the Reel Deal repo is
changed by this document.

### Findable (larger change)

Findable (`anigemmill/Tourism-AI-Growth-Platform`, `PRODUCT_BRAND=findable`) is single-tenant, uses its
own scrypt password sessions, and mixes The Outside In staff (FOUNDER, ADMIN) and business users
(OPERATOR) in one `User` table. Moving it means:

1. Each `Operator` (business) becomes an organisation in accounts; `UserBusiness` links become
   memberships; `isPrimaryContact` becomes the organisation's billing contact.
2. FOUNDER and ADMIN become **platform staff** in accounts (below), not members of customer
   organisations.
3. Its Stripe billing (test mode, per business) moves to accounts, keeping its decided rules
   (`docs/pilot-review.md` §3.9). Its plans and allowances stay in Findable's config.
4. Its pilot deployment (`PRODUCT_BRAND=outside-in`) can stay on its own login until the pilot ends.

### Platform staff and support access

The Outside In's own people need to help customers in every product. Accounts holds a separate
**platform staff** list (not an organisation role). A staff member opens a customer's data only through
a time-limited support session that is reason-stated, visible to the customer and audited in both
accounts and the product (Findable already records `SupportView`). Staff never appear in a customer's
member list.

## 8. Risks

| Risk | Mitigation |
|---|---|
| Accounts is a single point of failure for sign-in | Products keep working for already signed-in users (local verification and mirrors); accounts on its own monitoring and status page |
| Mirror drift | Ordered, idempotent events; nightly reconciliation; alert on lag over 5 minutes |
| Building identity is hard | Accounts is a thin layer on Supabase Auth plus Stripe, not custom auth. SSO/SAML later via Supabase |
| Supabase cross-project trust | Not relied on: products verify tokens in their own server and set claims per transaction |
