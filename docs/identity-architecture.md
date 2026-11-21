# Shared identity: how products sign people in

Status: **approved by the owner** (17 Nov 2026). Refines `spec.md` §2 with the concrete
Supabase mechanism. Nothing described here has been created yet.

## 1. Decisions in one table

| Question | Answer |
|---|---|
| Is this service the central identity service? | **Yes.** It is the only place customers sign in, the only place passwords, MFA and sign-in providers are configured, and the only issuer of customer identity tokens |
| Do Command Centre, Findable and Reel Deal use the same Supabase Auth? | **Yes: the account service's Supabase Auth, one per environment** (`accounts-dev`, later `accounts-prod`). Each product signs people in through it |
| Do they share one Supabase project (one database)? | **No.** Each product keeps its own database. Sharing an Auth server is not the same as sharing a database |
| Does any product keep its own customer sign-in? | **No.** A product's own Supabase project still has an Auth service (Supabase can't switch it off), but it is locked: sign-ups off, no providers, no customer users. No duplicate identities |
| How does a product know who someone is? | Standard OpenID Connect: the product redirects to the account service, gets back tokens, and verifies them offline with the account service's public keys (JWKS) |
| Where do organisation access, product permissions and entitlements live? | Organisation membership, organisation roles, product access and entitlements: here, copied to each product by signed events. Detailed product permissions: in each product |

## 2. The mechanism

Supabase Auth can act as an **OAuth 2.1 and OpenID Connect identity provider** for other applications
("Sign in with [your app]"). The account service's Supabase project is that provider; each product is
a registered OAuth client of it.

- Supported by Supabase: authorization code flow with PKCE, refresh tokens, ID tokens, OIDC discovery
  (`/auth/v1/.well-known/openid-configuration`), JWKS, client registration.
- Requires asymmetric JWT signing keys (RS256 or ES256) on the account project, so products can verify
  tokens with a public key and can never mint them.
- **Status: beta, free on all Supabase plans during the beta.** See §7 for how that risk is contained.

### Signing in to Command Centre

```
 Person            Command Centre (server)          Account service (Supabase Auth + account pages)
   │  open app  ───►  no session
   │                  redirect: /authorize?client_id=cc&code_challenge=…  ───────────►
   │  ◄───────────────────────────────────────────────  sign-in page (email + password, magic link,
   │  signs in, MFA if required  ─────────────────────►  MFA). Session cookie on the account domain only
   │                  ◄──────────── redirect to cc/callback?code=…
   │                  exchange code (PKCE + client secret) ─────────────────────────►
   │                  ◄──────────── access token, refresh token, ID token
   │                  store tokens in an encrypted, httpOnly session cookie (cc domain)
   │  ◄─ app ───────  every request: verify access token offline (JWKS, issuer, audience, expiry)
                      → user id → local mirror gives organisation, product access, roles
                      → database transaction runs as that user (request.jwt.claims → RLS)
```

**Opening a second product** (Findable, Reel Deal) repeats the redirect. The person is already signed in
on the account domain, so they come straight back with tokens: one account, no second password.

**Sign-out everywhere** ends the session in the account service and publishes a `session.revoked`
event; products drop their local session on receipt, and in any case can't refresh it.

### What each product's server does (same pattern Reel Deal uses today)

1. Verify the access token against the account service's JWKS: signature (asymmetric algorithm
   only), `iss` (exactly the environment's issuer), **`client_id` (exactly this product's OAuth
   client id in this environment)** and `exp`. Reject everything else, including tokens from another
   environment or issued to another product.

   > **Which claim identifies the product (finding, 21 Nov 2026).** Supabase's OAuth 2.1 server puts
   > the client in a `client_id` claim. `aud` is **not** the product: it stays Supabase's generic
   > value unless a Custom Access Token Hook rewrites it. So products check `client_id`, never `aud`,
   > to refuse a token issued to another product. If a hook later sets `aud` to the product key, check
   > both. Tokens from the account pages' own sign-in carry no `client_id` and must be refused by
   > every product.
2. Read the user id (`sub`). Authorisation never trusts other token claims; it reads the product's
   local mirror (organisations, memberships, product access, entitlements) kept current by events.
3. Run the request's queries in a transaction with `set local role authenticated` and
   `request.jwt.claims` set to the verified claims, so `auth.uid()` and RLS work as on Supabase. This
   is already proven in Command Centre's M1 database tests.

Products do **not** use their own Supabase Data API for customer requests, so they don't need
Supabase's third-party auth integration (which would add a per-user charge). It stays available if a
product ever needs Realtime or Storage with account tokens directly.

## 3. Layers of access

| Layer | Question | Owned by | Checked where |
|---|---|---|---|
| Identity | Who is this? | Account service (Supabase Auth) | Token verification in each product |
| Organisation | Which organisations do they belong to, with which organisation role? | Account service | Product mirror + RLS |
| Product access | May they open this product for this organisation? | Account service | Product mirror + RLS (`app.org_has_product`) |
| Entitlements | What does this organisation's plan allow here? | Account service (computed from subscriptions) | Product service layer |
| Product permissions | What may they do inside the product? | Each product | Product service layer + RLS |

## 4. Product-to-product and background calls

Supabase's OAuth server supports only the authorization code and refresh flows (no client
credentials). So:

- **Acting for a signed-in person** (Command Centre fetching that person's Findable results): token
  exchange through the account service, audience switched to the target product.
- **Background work** (an agent's scheduled run): the account service issues short-lived **service
  tokens** signed with its own separate key (its own JWKS), naming the organisation and
  `on_behalf_of`. Built in step A5; never a database service-role key shared between products.

## 5. Environments

| Environment | Identity (Supabase Auth) | Command Centre data | Customer data |
|---|---|---|---|
| Local | Not needed for most work: tests set verified claims directly (as M1/A1 tests do). For full sign-in, point at `accounts-dev` | Local Postgres (`npm run setup`) | Synthetic only |
| Development | `accounts-dev` project, Sydney | Local Postgres until Command Centre is first deployed; then its own `commandcentre-dev` project | Synthetic only, never copied from production |
| Production (later) | `accounts-prod` project, Sydney, in the paid organisation | `commandcentre-prod` project | Real |

Separation rules:

- Development and production never share a project, keys, OAuth clients or secrets.
- Each product accepts exactly one issuer per environment; a development token is rejected by
  production and vice versa (tested).
- No production data is copied into development. Development uses seeded synthetic organisations and
  users with `@example.com` addresses.
- Supabase's built-in email service only delivers to members of the Supabase organisation, so
  development emails can't reach customers. Production will use its own email provider.

## 6. Scope of A2 under this design

1. Configure `accounts-dev`: asymmetric signing keys, OAuth 2.1 server on, email + password and magic
   link, TOTP MFA, short access-token lifetime, redirect allow-list.
2. Account pages in this app: sign up, sign in, magic link, reset password, MFA enrolment, sign out
   everywhere, and the OAuth authorisation page (auto-approved for first-party clients).
3. Register a test OAuth client and prove the full flow end to end in automated tests: redirect, code
   exchange, offline verification, wrong-issuer rejection, sign-out.
4. Google and Microsoft sign-in: later in A2 or after, because each needs an OAuth app registered with
   Google Cloud / Microsoft Entra (owner action).

Command Centre's side (its OAuth callback, session and mirror) is Command Centre milestone M2b.

## 7. Risks

| Risk | Mitigation |
|---|---|
| OAuth 2.1 server is beta | Products depend only on standard OIDC (discovery, JWKS, code + PKCE), not Supabase-specific APIs, so the provider can be replaced without product changes. Fallback that still keeps one identity: products call the account project's Auth directly with `supabase-js` |
| Beta could become paid | Watch Supabase's pricing; record any change in `decisions.md` before it applies |
| Account service down | Already signed-in people keep working (offline verification, local mirrors); only new sign-ins wait |
| Mirror lag after removing someone | Events delivered within seconds; nightly reconciliation; access tokens kept short |
