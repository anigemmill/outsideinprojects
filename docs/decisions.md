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
