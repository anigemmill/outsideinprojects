# Build plan

Each step ends tested and reviewed before the next starts. This is milestone M2a in Command Centre's
plan (`anigemmill/commandcentre` `docs/specs/11-milestones.md`).

| # | Step | Done when |
|---|---|---|
| A1 | **Foundations.** Next.js + TypeScript strict, lint, CI, Supabase local stack, migrations, environment checks | CI green on an empty app; local stack starts with one command |
| A2 | **Sign-in.** Supabase Auth: email + password, magic link, Google, Microsoft, MFA; account pages (sign up, sign in, reset, security) | A person can create an account, sign in, turn on MFA and sign out everywhere |
| A3 | **Organisations.** Organisations, memberships, organisation roles, invitations, RLS and isolation tests | Isolation tests pass for every table; an owner invites a teammate who joins |
| A4 | **Product access and plans.** `product_access`, subscriptions assigned by staff (no Stripe yet), entitlements from each product's plan config | Staff give an organisation Command Centre; its members see it in the product switcher |
| A5 | **Tokens for products.** OpenID Connect provider for the products, asymmetric signing keys, public JWKS, token claims (`spec.md` §4), token exchange between products | A test product verifies a token offline and reads the right organisation |
| A6 | **Events.** Outbox, signed delivery to each product, retries, ordering per organisation, nightly reconciliation | A removed member is blocked in a test product within a minute; a dropped event is repaired by reconciliation |
| A7 | **Product switcher.** A small shared component every product embeds | Works in light and dark, keyboard and screen reader |
| A8 | **Platform staff and support access** | A staff support session is time-limited, visible to the customer and audited |
| A9 | **Stripe billing** (later, Command Centre M17): Checkout, Customer Portal, webhooks, Findable's rules | Test-mode subscription changes flow to entitlements in each product |

## Then

1. Command Centre signs in through this service (Command Centre M2b).
2. Findable: staging copy moved onto this service and tested, then production switched at a time agreed
   with Te Puia, with the old sign-in kept for a week as a fallback (`spec.md` §7).
3. Reel Deal moved onto this service (`spec.md` §7).
