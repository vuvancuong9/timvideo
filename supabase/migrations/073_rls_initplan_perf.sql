-- 073: Tăng tốc RLS — gọi auth.uid() / current_app_role() 1 LẦN mỗi truy vấn.
-- Gọi trực tiếp trong policy thì Postgres đánh giá lại cho TỪNG DÒNG: với
-- ~48k video, mỗi lần nhân viên mở "Video của tôi" tra profiles ~48k lần →
-- truy vấn vượt statement_timeout 8s của role authenticated (lỗi 57014).
-- Bọc trong (select ...) biến thành InitPlan, tính 1 lần. Logic phân quyền
-- GIỮ NGUYÊN (cùng điều kiện, cùng role).

-- video_submissions
alter policy vs_select on public.video_submissions
  using (created_by = (select auth.uid())
         or (select public.current_app_role()) in ('accountant','aggregator','admin'));
alter policy vs_insert on public.video_submissions
  with check (created_by = (select auth.uid())
              and (select public.current_app_role()) in ('staff','aggregator','admin'));
alter policy vs_update on public.video_submissions
  using (created_by = (select auth.uid())
         or (select public.current_app_role()) in ('aggregator','admin'))
  with check (created_by = (select auth.uid())
              or (select public.current_app_role()) in ('aggregator','admin'));
alter policy vs_delete on public.video_submissions
  using ((select public.current_app_role()) = 'admin');

-- Bảng con: xem được khi xem được submission cha. video_submission_id NOT NULL
-- + FK nên "role cấp cao OR (submission cha là của mình)" tương đương bản cũ.
do $$
declare
  t text;
  child_tables text[] := array[
    'video_review_jobs','video_extracted_assets','video_content_analysis',
    'facebook_policy_checks','video_creative_scores','video_final_decisions'
  ];
begin
  foreach t in array child_tables loop
    execute format($f$
      alter policy %I_select on public.%I
        using ((select public.current_app_role()) in ('accountant','aggregator','admin')
               or exists (select 1 from public.video_submissions s
                          where s.id = %I.video_submission_id
                            and s.created_by = (select auth.uid())))
    $f$, t, t, t);
  end loop;
  -- video_edit_jobs không nằm trong migrations của repo (tạo ngoài), chỉ sửa nếu có.
  if to_regclass('public.video_edit_jobs') is not null
     and exists (select 1 from pg_policies where schemaname = 'public'
                 and tablename = 'video_edit_jobs' and policyname = 'vej_select') then
    execute $f$
      alter policy vej_select on public.video_edit_jobs
        using ((select public.current_app_role()) in ('accountant','aggregator','admin')
               or exists (select 1 from public.video_submissions s
                          where s.id = video_edit_jobs.video_submission_id
                            and s.created_by = (select auth.uid())))
    $f$;
  end if;
end $$;

-- profiles
alter policy profiles_select on public.profiles
  using (id = (select auth.uid())
         or (select public.current_app_role()) in ('accountant','aggregator','admin'));
alter policy profiles_update on public.profiles
  using (id = (select auth.uid()) or (select public.current_app_role()) = 'admin')
  with check (id = (select auth.uid()) or (select public.current_app_role()) = 'admin');

-- product_categories
alter policy categories_write on public.product_categories
  using ((select public.current_app_role()) = 'admin')
  with check ((select public.current_app_role()) = 'admin');

-- affiliate_accounts
alter policy affiliate_select on public.affiliate_accounts
  using ((select public.current_app_role()) in ('accountant','aggregator','admin'));
alter policy affiliate_write on public.affiliate_accounts
  using ((select public.current_app_role()) = 'admin')
  with check ((select public.current_app_role()) = 'admin');

-- facebook_pages
alter policy facebook_pages_select on public.facebook_pages
  using ((select public.current_app_role()) in ('accountant','aggregator','admin'));
alter policy facebook_pages_write on public.facebook_pages
  using ((select public.current_app_role()) in ('aggregator','admin'))
  with check ((select public.current_app_role()) in ('aggregator','admin'));

-- sales_records
alter policy sales_select on public.sales_records
  using (employee_id = (select auth.uid())
         or (select public.current_app_role()) in ('accountant','admin'));
alter policy sales_write on public.sales_records
  using ((select public.current_app_role()) = 'admin')
  with check ((select public.current_app_role()) = 'admin');

-- audit_logs / video_review_summary
alter policy audit_select on public.audit_logs
  using ((select public.current_app_role()) = 'admin');
alter policy vrs_select on public.video_review_summary
  using ((select public.current_app_role()) in ('accountant','aggregator','admin'));

-- Index: danh sách "video của tôi" (lọc người tạo + sắp theo thời gian) và
-- sinh Sub ID (đếm sub_id LIKE 'ddmm<account>%' — cần text_pattern_ops).
create index if not exists idx_video_submissions_created_by_created_at
  on public.video_submissions (created_by, created_at desc);
create index if not exists idx_video_submissions_sub_id_prefix
  on public.video_submissions (sub_id text_pattern_ops);

notify pgrst, 'reload schema';
