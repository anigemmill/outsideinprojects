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

## Not set up yet

- Error monitoring (Sentry): needs an account and DSN; added when the app is first deployed.
- Hosted Supabase and Vercel projects (Sydney): created at first deployment.
- The Supabase Docker stack: Docker isn't available in the environment this was built in, so the local
  database is plain Postgres plus `supabase/local/`.
