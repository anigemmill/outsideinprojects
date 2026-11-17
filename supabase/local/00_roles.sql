-- LOCAL ONLY. The Supabase roles and default grants, so migrations run unchanged on plain Postgres.
-- Never applied to a Supabase project (detected by the supabase_admin role; see src/server/db/migrate.ts).

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;

-- Supabase's default privileges: every new public table is granted to these roles.
-- Reproduced so local tests see the same (over-broad) starting point as a real project;
-- the foundation migration then removes them.
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
