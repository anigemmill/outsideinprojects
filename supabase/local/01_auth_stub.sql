-- LOCAL ONLY, and only when Supabase Auth is not running locally (no auth.users table).
-- A minimal stand-in for the auth schema so migrations and RLS tests run on plain Postgres.
-- With the local Supabase Auth server (npm run auth:local) the real auth schema is used instead.

create schema if not exists auth;
grant usage on schema auth to anon, authenticated, service_role;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  created_at timestamptz not null default now()
);

-- Same contract as Supabase: identity comes from the request's JWT claims.
create or replace function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;

create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(coalesce(current_setting('request.jwt.claim.sub', true), auth.jwt() ->> 'sub'), '')::uuid
$$;

grant execute on function auth.jwt(), auth.uid() to anon, authenticated, service_role;
