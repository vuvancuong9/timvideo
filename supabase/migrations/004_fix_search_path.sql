-- =====================================================================
--  timvideo - 004_fix_search_path
--  Khóa search_path = '' (fully-qualified) cho current_app_role để pass
--  Supabase linter 0011. Re-grant execute đúng phạm vi sau khi tạo lại.
-- =====================================================================

create or replace function public.current_app_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = (select auth.uid());
$$;

-- create or replace reset grants -> revoke khỏi public/anon, chỉ cho authenticated + service_role.
revoke all on function public.current_app_role() from public, anon;
grant execute on function public.current_app_role() to authenticated, service_role;
