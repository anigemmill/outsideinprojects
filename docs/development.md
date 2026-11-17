# Development

## Requirements

- Node 22 or later (`.nvmrc`)
- PostgreSQL 16 or later server binaries (`initdb`, `pg_ctl`, `psql`) for the local database.
  Plain Postgres stands in for Supabase locally: `supabase/local/` adds the roles and `auth.uid()`
  the migrations rely on. It is never applied to a real Supabase project.

## First run

```bash
npm install
```

```bash
npm run setup
```

`setup` starts a local Postgres in `.data/postgres` (port 54331, git-ignored), creates the `accounts`
database and applies the migrations. Then copy `.env.example` to `.env.local` and start the app:

```bash
npm run dev
```

The app runs on http://localhost:3100. `/api/health` reports whether the database is configured.

## Checks

| Command | What it does |
|---|---|
| `npm run test:pages` | Browser checks of the sign-in pages against a running app (see Sign-in) |
| `npm run check` | Migration safety, type check, lint and unit tests (what CI runs, minus the build) |
| `npm run test:db` | Database tests against the local database (starts it if needed via `npm run setup` first) |
| `npm run check:env` | Validates the current environment the way the server does at start-up |
| `npm run build` | Production build |

CI (`.github/workflows/ci.yml`) runs every check, including the database tests against its own
Postgres 16 service, on every push and pull request.

## Migrations

- Files live in `supabase/migrations/`, named `<14-digit timestamp>_<snake_case>.sql` (the Supabase CLI format).
- Additive only. `npm run check:migrations` fails on drops, truncates, deletes, row updates, renames, type
  changes and disabling RLS. A reviewed exception is marked `-- reviewed: destructive` on the same line.
- Every table in `public` needs RLS and at least one policy. `app.tables_missing_rls` lists offenders and
  the database tests fail if it returns anything.
- New tables get **no** privileges for `anon` or `authenticated` by default (the foundation migration
  removes Supabase's broad defaults). Grant what a table needs explicitly.

## Sign-in (Supabase Auth)

The account pages talk to Supabase Auth from the server only. Two ways to run them:

1. **Against `accounts-dev`** (the hosted development project, once it exists): put its URL and keys
   in `.env.local` (`docs/environments.md`).
2. **Against real Supabase Auth on your machine:** `npm run auth:local` downloads the pinned Supabase
   Auth release (`v2.198.0`, SHA-256 checked), generates local-only signing keys, and runs it at
   `http://localhost:54321/auth/v1` with the OAuth 2.1 server on and a local mail catcher. Use a fresh
   database for it (Supabase Auth must create the `auth` schema before `npm run db:migrate` runs):

   ```bash
   createdb -h localhost -p 54331 -U postgres accounts_auth
   ```

   ```bash
   AUTH_DATABASE_URL="postgres://postgres@localhost:54331/accounts_auth?sslmode=disable" npm run auth:local
   ```

   Then copy the values from `.data/auth/local.env` into `.env.local`, set `DATABASE_URL` to the same
   `accounts_auth` database and run `npm run db:migrate`.

Without either, every page shows "Sign-in isn't set up here yet" instead of a form.

`npm run test:pages` checks the pages in a real browser against a running app (`npm run build`, then
`npm start`): accessibility (axe, WCAG 2.2 AA) in light and dark mode, the redirect for signed-out
visitors, open-redirect protection, field errors, and the message when Supabase Auth can't be reached.
It needs no Supabase Auth server and signs nobody in.

## Not set up yet

- Error monitoring (Sentry): needs an account and DSN; added when the app is first deployed.
- Hosted Supabase and Vercel projects (Sydney): created at first deployment.
- The Supabase Docker stack: Docker isn't available in the environment this was built in, so the local
  database is plain Postgres plus `supabase/local/`.
- End-to-end sign-in tests (sign up, confirm by email, MFA, OAuth flow for a product) against Supabase
  Auth: written next, once Supabase Auth can run (locally or as `accounts-dev`). See `docs/plan.md` A2.
- Google and Microsoft sign-in: need OAuth apps registered with Google Cloud and Microsoft Entra.
