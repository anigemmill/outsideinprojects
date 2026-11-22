# Reel Deal: preparing for and joining the shared account

Status: **plan, 22 Nov 2026. Nothing changed in Reel Deal.** Decided: Reel Deal does **not** open
standalone customer registration while the shared identity service is being built (D4), and its
signed-in app will use `reeldeal.theoutsidein.nz` (D3). Its marketing stays at
`theoutsidein.nz/reeldeal/`.

## 1. Reel Deal today (Verified 21–22 Nov, from its repository)

- One Next.js app, built with `basePath: /reeldeal`, served at `theoutsidein.nz/reeldeal/` through the
  website's Netlify proxy and directly at `reeldeal.theoutsidein.nz/reeldeal/`. Website live; sign-in
  **not open** (`SIGN_UP_OPEN` off; no Supabase keys in production).
- Its own Supabase Auth (project `reeldeal`, `jzshbaqfrrgsyiciuzfe`, 0 users) with built sign-up, email
  verification, sign-in, reset, password and email change, sign out everywhere (`@supabase/ssr`
  cookies).
- Its own `organisations` and `memberships` (roles `viewer < editor < admin < owner`), onboarding that
  creates a workspace, plan id and credit ledger, MCP server with personal access tokens and an OAuth
  resource-server verifier, restricted runtime roles, the migration target guard.
- Planned in its `docs/launch-domain.md` ("Opening sign-in"): Resend SMTP and Supabase Auth URLs on
  its **own** project, then opening sign-up. **Under D4, those steps are not done.**

## 2. Stop now (to avoid building what will be replaced)

| Do not build or configure | Why |
|---|---|
| SMTP, email templates, Site URL and redirect URLs on Reel Deal's own Supabase Auth | Sign-in emails will come from the account service |
| More sign-in, sign-up, password, email-change, MFA or session-management screens | The account app owns all of them |
| Self-service workspace creation and invitations | Organisations and invitations move to the account service |
| Plan selection or billing pages | Billing moves to the account service (step 10) |

## 3. Keep building (unaffected)

Studio, Autopilot, library, analysis, rendering, exports, brand profiles, credit ledger and usage
metering, restricted database roles, RLS and isolation tests, the MCP server's tools. The "who is this
person and which organisation" question is answered by one small module, so it can be swapped.

**Recommended now (small, safe):** route every session lookup through one function returning
`{ userId, orgId, role }` (much is already in `src/server/app/session.ts`), so the switch to the shared
account replaces one module, not the app.

## 4. Changes to join the shared account (after Command Centre has proved the flow)

| Area | Change |
|---|---|
| Sign-in | Replace `@supabase/ssr` sign-in with the OIDC client used by Command Centre (shared verifier, `client_id` check, encrypted host-only session cookie) |
| Host | Signed-in routes served only on `reeldeal.theoutsidein.nz` (redirect app routes when the host is `theoutsidein.nz`); cookies host-only there, so they are no longer sent to the website |
| Organisations and memberships | Become read-only mirrors fed by account events, keyed by the account service's ids; onboarding stops creating organisations |
| Roles | Organisation `owner`→`owner`, `admin`→`admin`, `member`→`editor` by default; Reel Deal keeps its own product roles |
| Plans and credits | Plan assignment comes from the entitlement mirror; the credit ledger and costs stay in Reel Deal |
| MCP | Personal access tokens stay bound to user ids (same ids, since accounts are created in the account service); the OAuth resource server accepts the account issuer |
| Own Supabase Auth | Locked: sign-ups off, no providers, no users |
| Tests | The same rejection, revocation, event and isolation tests as Command Centre |

## 5. Migration

None, as long as D4 holds: there are no Reel Deal users. If standalone registration were ever opened
first, its users and organisations would be imported into the account service with ids preserved.

## 6. Order

After Command Centre's integration is verified (`plan.md` step 7), Reel Deal follows in development,
then production once the account app is live in production.
