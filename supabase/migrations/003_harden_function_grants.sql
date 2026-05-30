-- =====================================================================
--  timvideo - 003_harden_function_grants
--  Thu hồi EXECUTE trên các trigger function (không cần gọi qua RPC).
--  Trigger vẫn chạy bình thường vì là SECURITY DEFINER do owner thực thi.
--  current_app_role() vẫn cần EXECUTE cho 'authenticated' để RLS hoạt động.
-- =====================================================================

revoke all on function public.handle_new_user()      from public, anon, authenticated;
revoke all on function public.enforce_video_update()  from public, anon, authenticated;
revoke all on function public.enforce_profile_update() from public, anon, authenticated;

revoke all on function public.current_app_role() from public, anon;
grant execute on function public.current_app_role() to authenticated, service_role;
