-- LOCAL ONLY. Re-applied on every migration run (idempotent, grants no default privileges).
-- When real Supabase Auth has created the auth schema locally, let the API roles call
-- auth.uid() and auth.jwt(), as they can on Supabase.
do $$ begin
  if exists (select 1 from pg_namespace where nspname = 'auth') then
    grant usage on schema auth to anon, authenticated, service_role;
    if to_regprocedure('auth.uid()') is not null then grant execute on function auth.uid() to anon, authenticated, service_role; end if;
    if to_regprocedure('auth.jwt()') is not null then grant execute on function auth.jwt() to anon, authenticated, service_role; end if;
  end if;
end $$;
