# Outside In account service

One account for every Outside In product. People sign in once; organisations add **Command Centre**,
**Findable** and **Reel Deal** by subscribing to them.

**Status: specification.** No code yet.

| Document | What it is |
|---|---|
| [`docs/spec.md`](docs/spec.md) | The design: shared sign-in, organisations, product access, subscriptions, token claims, mirrors, migration of Reel Deal and Findable |
| [`docs/plan.md`](docs/plan.md) | Build plan, in order |
| [`docs/decisions.md`](docs/decisions.md) | Decisions specific to this service |

## What this service owns

- People: sign-in, sessions, MFA, Google and Microsoft sign-in (Supabase Auth)
- Organisations, organisation roles, invitations, agency ↔ client links
- Which products each organisation has and which members can open them
- Subscriptions and billing (Stripe): one customer per organisation, bundles and single products
- Entitlements per product, published to the products
- Platform staff and audited support access
- Signed events that keep each product's copy of this data up to date

## What it does not own

Everything a product does. Strategy and projects (Command Centre), AI visibility (Findable) and video
(Reel Deal) stay in their own databases and repositories:

| Product | Repository |
|---|---|
| Command Centre | `anigemmill/commandcentre` |
| Findable (and the Te Puia pilot) | `anigemmill/Tourism-AI-Growth-Platform` |
| Reel Deal | `anigemmill/reeldeal` |
