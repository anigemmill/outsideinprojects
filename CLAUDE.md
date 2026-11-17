# Outside In account service

Shared sign-in, organisations, product access, subscriptions and billing for every Outside In product
(Command Centre, Findable, Reel Deal). Read `docs/spec.md` first; build in the order of `docs/plan.md`.

## Rules

- **Thin layer, not custom auth.** Supabase Auth does credentials, sessions and MFA. Stripe does payments.
  This service adds organisations, product access, entitlements, events and staff support access.
- **Products never depend on a live call to this service** to authorise a request. They verify tokens
  locally (JWKS) and read their own mirror of account data. If this service is down, signed-in people
  keep working.
- **Events are the contract.** Every change to organisations, memberships, product access,
  subscriptions or entitlements writes an outbox event in the same transaction. Events are ordered per
  organisation, signed, idempotent, and never edited. A schema change to an event is versioned.
- **RLS on every table**, deny by default, with isolation tests per table, like the products.
- **No product data here.** Workspaces, brands, projects, media, visibility runs and similar belong to
  the products.
- **Billing rules** follow Findable's decided rules (`docs/decisions.md`). Money states are never mixed:
  manual and provider-confirmed records stay separate; nothing is shown as paid until the provider says so.
- **Platform staff are not customer members.** Support access is time-limited, reason-stated, visible
  to the customer and audited.
- Hosting: Sydney (Supabase `ap-southeast-2`, Vercel `syd1`), like the products.
- Stack: Next.js (App Router) for the account pages and API, TypeScript strict, Supabase, Stripe.
- No fake functionality presented as real. Mocked parts are labelled in code and UI.
- Accessibility: WCAG 2.2 AA. The account pages use the shared foundation's type rules with a neutral
  Outside In theme, so they don't look like any one product.
- Small, phased changes. Record design changes in `docs/decisions.md`.
- Anything in `[BRACKETS]` is copy or data still needed from the owner. Keep it bracketed.
