-- Foundation: deny-by-default privileges and the row level security guard.

-- Supabase grants every new public table and function to anon and authenticated by default.
-- Remove that, so each table must grant access explicitly, with RLS still applied on top.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;
revoke create on schema public from public;

-- Helper schema for policy functions. Not exposed through the Data API.
create schema if not exists app;
revoke all on schema app from public;
grant usage on schema app to authenticated, service_role;

-- Every table in the public schema must have RLS enabled and at least one policy.
-- Tests and CI fail if this view returns any row.
create or replace view app.tables_missing_rls with (security_invoker = true) as
select c.relname::text as table_name,
       case when not c.relrowsecurity then 'rls disabled' else 'no policies' end as problem
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind in ('r', 'p')
  and (not c.relrowsecurity or not exists (select 1 from pg_policy p where p.polrelid = c.oid));
