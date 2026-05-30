-- =====================================================================
--  timvideo - 060_video_intake_policy_scoring
--  Module: Video Intake & Facebook Policy Scoring.
--
--  LƯU Ý: bảng public.video_submissions ở module cũ (migration 001) có
--  schema khác và đang RỖNG (0 rows). Migration này thay thế nó bằng
--  schema mới của module review. Vì không có dữ liệu nên drop & recreate
--  là an toàn. Các bảng profiles/affiliate_accounts/product_categories/
--  audit_logs/sales_records được giữ nguyên.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Gỡ bảng video cũ (0 rows) + enum cũ chỉ dùng bởi nó.
--    CASCADE sẽ gỡ luôn policy/trigger cũ và FK từ sales_records.
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from information_schema.tables
             where table_schema = 'public' and table_name = 'video_submissions') then
    -- chỉ drop nếu rỗng, tránh mất dữ liệu ngoài ý muốn
    if (select count(*) from public.video_submissions) = 0 then
      execute 'drop table public.video_submissions cascade';
    else
      raise exception 'video_submissions khong rong - dung lai de tranh mat du lieu';
    end if;
  end if;
end $$;

drop type if exists public.video_status;
drop type if exists public.video_source;

-- ---------------------------------------------------------------------
-- 1. ENUMS
-- ---------------------------------------------------------------------
do $$ begin
  create type public.video_source_type as enum
    ('tiktok_url','facebook_url','youtube_url','drive_upload','other_url');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.video_submission_status as enum
    ('submitted','queued','processing','reviewed','need_edit','approved','rejected','archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.video_review_job_status as enum
    ('queued','running','done','failed','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.video_review_stage as enum
    ('queued','claimed','ingest','extract','analyze','policy_check','score','decision','done','failed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.video_final_action as enum
    ('APPROVE_RUN_ADS','NEED_EDIT','REMAKE_SAFE','REJECT_POLICY_RISK','REJECT_COPYRIGHT_RISK','LOW_PERFORMANCE');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.risk_level as enum ('low','medium','high','critical');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.analysis_confidence as enum ('low','medium','high');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- 2. TABLES
-- ---------------------------------------------------------------------
create table if not exists public.video_submissions (
  id uuid primary key default gen_random_uuid(),

  created_by uuid not null references public.profiles(id),
  shopee_product_url text not null,
  product_price numeric(18,2) not null default 0,
  commission_percent numeric(6,2) not null default 0,
  estimated_commission numeric(18,2)
    generated always as ((product_price * commission_percent) / 100) stored,

  category_id uuid null references public.product_categories(id),

  source_type public.video_source_type not null,
  original_video_url text null,
  canonical_video_url text null,
  canonical_video_hash text null,

  drive_file_id text null,
  drive_file_name text null,
  drive_web_url text null,
  drive_folder_id text null,
  file_sha256 text null,
  perceptual_hash text null,

  assigned_affiliate_account_id uuid null references public.affiliate_accounts(id),
  assigned_by uuid null references public.profiles(id),
  assigned_at timestamptz null,

  short_link text null,
  short_link_by uuid null references public.profiles(id),
  short_link_at timestamptz null,

  status public.video_submission_status not null default 'submitted',

  staff_note text null,
  aggregate_note text null,
  admin_note text null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- re-add FK từ sales_records (đã bị cascade gỡ khi drop bảng cũ)
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='sales_records'
               and column_name='video_submission_id')
     and not exists (select 1 from information_schema.table_constraints
             where table_schema='public' and table_name='sales_records'
               and constraint_name='sales_records_video_submission_id_fkey') then
    execute 'alter table public.sales_records
             add constraint sales_records_video_submission_id_fkey
             foreign key (video_submission_id)
             references public.video_submissions(id)';
  end if;
end $$;

create table if not exists public.video_review_jobs (
  id uuid primary key default gen_random_uuid(),
  video_submission_id uuid not null references public.video_submissions(id) on delete cascade,

  status public.video_review_job_status not null default 'queued',
  stage public.video_review_stage not null default 'queued',

  progress_total int not null default 0,
  progress_done int not null default 0,

  attempt_count int not null default 0,
  locked_by text null,
  locked_at timestamptz null,

  error text null,
  raw_params jsonb not null default '{}'::jsonb,

  started_at timestamptz null,
  finished_at timestamptz null,
  created_at timestamptz not null default now()
);

create table if not exists public.video_extracted_assets (
  id uuid primary key default gen_random_uuid(),
  video_submission_id uuid not null references public.video_submissions(id) on delete cascade,

  thumbnail_url text null,
  frame_urls jsonb not null default '[]'::jsonb,
  audio_file_url text null,

  transcript_text text null,
  ocr_text text null,

  detected_logos jsonb not null default '[]'::jsonb,
  detected_faces jsonb not null default '[]'::jsonb,
  detected_text_claims jsonb not null default '[]'::jsonb,

  duration_seconds int null,
  width int null,
  height int null,
  fps numeric null,

  raw_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.video_content_analysis (
  id uuid primary key default gen_random_uuid(),
  video_submission_id uuid not null references public.video_submissions(id) on delete cascade,

  provider text not null default 'gemini',
  model text null,
  confidence public.analysis_confidence not null default 'medium',

  summary text null,
  hook_3s text null,
  visual_summary text null,
  product_detected text null,

  claims_detected jsonb not null default '[]'::jsonb,
  pain_points jsonb not null default '[]'::jsonb,
  audience_profile jsonb not null default '{}'::jsonb,
  key_moments jsonb not null default '[]'::jsonb,
  strong_scenes jsonb not null default '[]'::jsonb,
  weak_scenes jsonb not null default '[]'::jsonb,
  remake_angles jsonb not null default '[]'::jsonb,

  raw_response jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.facebook_policy_checks (
  id uuid primary key default gen_random_uuid(),
  video_submission_id uuid not null references public.video_submissions(id) on delete cascade,

  provider text not null default 'openai',
  model text null,
  confidence public.analysis_confidence not null default 'medium',

  policy_safety_score numeric not null default 0,
  copyright_safety_score numeric not null default 0,

  misleading_claim_risk public.risk_level not null default 'low',
  health_claim_risk public.risk_level not null default 'low',
  personal_attribute_risk public.risk_level not null default 'low',
  before_after_risk public.risk_level not null default 'low',
  shocking_content_risk public.risk_level not null default 'low',
  adult_sensitive_risk public.risk_level not null default 'low',
  ip_trademark_risk public.risk_level not null default 'low',
  restricted_product_risk public.risk_level not null default 'low',

  risk_reasons jsonb not null default '[]'::jsonb,
  policy_references jsonb not null default '[]'::jsonb,
  suggested_fixes jsonb not null default '[]'::jsonb,

  final_policy_level public.risk_level not null default 'low',

  raw_response jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.video_creative_scores (
  id uuid primary key default gen_random_uuid(),
  video_submission_id uuid not null references public.video_submissions(id) on delete cascade,

  provider text not null default 'openai',
  model text null,
  confidence public.analysis_confidence not null default 'medium',

  hook_score numeric not null default 0,
  product_clarity_score numeric not null default 0,
  demo_score numeric not null default 0,
  trust_score numeric not null default 0,
  affiliate_fit_score numeric not null default 0,
  remake_score numeric not null default 0,
  creative_score numeric not null default 0,

  reasons jsonb not null default '[]'::jsonb,
  suggested_titles jsonb not null default '[]'::jsonb,
  suggested_scripts jsonb not null default '[]'::jsonb,
  suggested_edits jsonb not null default '[]'::jsonb,

  raw_response jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.video_final_decisions (
  id uuid primary key default gen_random_uuid(),
  video_submission_id uuid not null references public.video_submissions(id) on delete cascade,

  creative_score numeric not null default 0,
  policy_safety_score numeric not null default 0,
  copyright_safety_score numeric not null default 0,
  final_score numeric not null default 0,

  final_action public.video_final_action not null,
  decision_reason text null,
  blocking_reasons jsonb not null default '[]'::jsonb,
  required_edits jsonb not null default '[]'::jsonb,

  created_at timestamptz not null default now()
);

create table if not exists public.video_review_summary (
  id uuid primary key default gen_random_uuid(),
  total_submissions int not null default 0,
  queued_count int not null default 0,
  processing_count int not null default 0,
  reviewed_count int not null default 0,
  approved_count int not null default 0,
  need_edit_count int not null default 0,
  rejected_policy_count int not null default 0,
  rejected_copyright_count int not null default 0,
  low_performance_count int not null default 0,
  avg_creative_score numeric not null default 0,
  avg_policy_safety_score numeric not null default 0,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 3. INDEXES
-- ---------------------------------------------------------------------
create unique index if not exists ux_video_submissions_canonical_hash
  on public.video_submissions (canonical_video_hash)
  where canonical_video_hash is not null;
create index if not exists idx_video_submissions_created_by
  on public.video_submissions (created_by);
create index if not exists idx_video_submissions_status
  on public.video_submissions (status);
create index if not exists idx_video_submissions_source_type
  on public.video_submissions (source_type);
create index if not exists idx_video_submissions_created_at
  on public.video_submissions (created_at desc);
create index if not exists idx_video_submissions_file_sha256
  on public.video_submissions (file_sha256) where file_sha256 is not null;

create index if not exists idx_video_review_jobs_status_created
  on public.video_review_jobs (status, created_at);
create index if not exists idx_video_review_jobs_locked
  on public.video_review_jobs (locked_by, locked_at);
create index if not exists idx_video_review_jobs_submission
  on public.video_review_jobs (video_submission_id);

create index if not exists idx_fb_policy_checks_score
  on public.facebook_policy_checks (policy_safety_score);
create index if not exists idx_fb_policy_checks_submission
  on public.facebook_policy_checks (video_submission_id, created_at desc);
create index if not exists idx_creative_scores_score
  on public.video_creative_scores (creative_score);
create index if not exists idx_creative_scores_submission
  on public.video_creative_scores (video_submission_id, created_at desc);
create index if not exists idx_final_decisions_action
  on public.video_final_decisions (final_action);
create index if not exists idx_final_decisions_submission
  on public.video_final_decisions (video_submission_id, created_at desc);
create index if not exists idx_content_analysis_submission
  on public.video_content_analysis (video_submission_id, created_at desc);
create index if not exists idx_extracted_assets_submission
  on public.video_extracted_assets (video_submission_id, created_at desc);

-- ---------------------------------------------------------------------
-- 4. UPDATED_AT trigger + field-level enforcement cho video_submissions
-- ---------------------------------------------------------------------
create or replace function public.enforce_video_submission_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.user_role;
begin
  if coalesce(auth.role(), '') = 'service_role' then
    new.updated_at := now();
    return new;
  end if;

  r := public.current_app_role();

  if r = 'admin' then
    new.updated_at := now();
    return new;

  elsif r = 'aggregator' then
    if new.short_link            is distinct from old.short_link
    or new.short_link_by         is distinct from old.short_link_by
    or new.short_link_at         is distinct from old.short_link_at
    or new.shopee_product_url    is distinct from old.shopee_product_url
    or new.product_price         is distinct from old.product_price
    or new.commission_percent    is distinct from old.commission_percent
    or new.original_video_url    is distinct from old.original_video_url
    or new.canonical_video_hash  is distinct from old.canonical_video_hash
    or new.created_by            is distinct from old.created_by
    or new.source_type           is distinct from old.source_type then
      raise exception 'AGGREGATOR_FIELD_FORBIDDEN: Tong hop khong duoc sua truong nay';
    end if;
    new.updated_at := now();
    return new;

  elsif r = 'staff' then
    if old.created_by <> auth.uid() then
      raise exception 'STAFF_FORBIDDEN_OTHER: Staff chi sua video cua chinh minh';
    end if;
    if new.assigned_affiliate_account_id is distinct from old.assigned_affiliate_account_id
    or new.short_link  is distinct from old.short_link
    or new.admin_note  is distinct from old.admin_note
    or new.status      is distinct from old.status
    or new.created_by  is distinct from old.created_by then
      raise exception 'STAFF_FIELD_FORBIDDEN: Staff khong duoc sua truong nay';
    end if;
    new.updated_at := now();
    return new;

  else
    raise exception 'FORBIDDEN_UPDATE: Role nay khong duoc sua video';
  end if;
end;
$$;

drop trigger if exists trg_enforce_video_submission_update on public.video_submissions;
create trigger trg_enforce_video_submission_update
  before update on public.video_submissions
  for each row execute function public.enforce_video_submission_update();

-- ---------------------------------------------------------------------
-- 5. RPC claim_video_review_job
-- ---------------------------------------------------------------------
create or replace function public.claim_video_review_job(worker_name text)
returns public.video_review_jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  job public.video_review_jobs;
begin
  select * into job
  from public.video_review_jobs j
  where (
        j.status = 'queued'
     or (j.status = 'running'
         and j.locked_at is not null
         and j.locked_at < now() - interval '30 minutes')
      )
    and j.attempt_count < 3
  order by j.created_at asc
  for update skip locked
  limit 1;

  if not found then
    return null;
  end if;

  update public.video_review_jobs
  set status = 'running',
      stage = 'claimed',
      locked_by = worker_name,
      locked_at = now(),
      attempt_count = attempt_count + 1,
      started_at = coalesce(started_at, now())
  where id = job.id
  returning * into job;

  return job;
end;
$$;

revoke all on function public.claim_video_review_job(text) from public, anon, authenticated;
grant execute on function public.claim_video_review_job(text) to service_role;

-- ---------------------------------------------------------------------
-- 6. refresh_video_review_summary()
-- ---------------------------------------------------------------------
create or replace function public.refresh_video_review_summary()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.video_review_summary%rowtype;
begin
  select
    count(*) ,
    count(*) filter (where status = 'queued'),
    count(*) filter (where status = 'processing'),
    count(*) filter (where status = 'reviewed'),
    count(*) filter (where status = 'approved'),
    count(*) filter (where status = 'need_edit')
  into s.total_submissions, s.queued_count, s.processing_count,
       s.reviewed_count, s.approved_count, s.need_edit_count
  from public.video_submissions;

  select
    count(*) filter (where final_action = 'REJECT_POLICY_RISK'),
    count(*) filter (where final_action = 'REJECT_COPYRIGHT_RISK'),
    count(*) filter (where final_action = 'LOW_PERFORMANCE')
  into s.rejected_policy_count, s.rejected_copyright_count, s.low_performance_count
  from public.video_final_decisions;

  select coalesce(avg(creative_score),0) into s.avg_creative_score
  from public.video_creative_scores;

  select coalesce(avg(policy_safety_score),0) into s.avg_policy_safety_score
  from public.facebook_policy_checks;

  delete from public.video_review_summary;
  insert into public.video_review_summary (
    total_submissions, queued_count, processing_count, reviewed_count,
    approved_count, need_edit_count, rejected_policy_count,
    rejected_copyright_count, low_performance_count,
    avg_creative_score, avg_policy_safety_score, updated_at
  ) values (
    s.total_submissions, s.queued_count, s.processing_count, s.reviewed_count,
    s.approved_count, s.need_edit_count, s.rejected_policy_count,
    s.rejected_copyright_count, s.low_performance_count,
    s.avg_creative_score, s.avg_policy_safety_score, now()
  );
end;
$$;

revoke all on function public.refresh_video_review_summary() from public, anon, authenticated;
grant execute on function public.refresh_video_review_summary() to service_role;

-- ---------------------------------------------------------------------
-- 7. RLS
-- ---------------------------------------------------------------------
alter table public.video_submissions       enable row level security;
alter table public.video_review_jobs        enable row level security;
alter table public.video_extracted_assets   enable row level security;
alter table public.video_content_analysis   enable row level security;
alter table public.facebook_policy_checks   enable row level security;
alter table public.video_creative_scores    enable row level security;
alter table public.video_final_decisions    enable row level security;
alter table public.video_review_summary     enable row level security;

-- helper: video xem được bởi user hiện tại
-- (inline trong policy bằng EXISTS)

-- video_submissions
drop policy if exists vs_select on public.video_submissions;
create policy vs_select on public.video_submissions
  for select to authenticated
  using (created_by = auth.uid()
         or public.current_app_role() in ('accountant','aggregator','admin'));

drop policy if exists vs_insert on public.video_submissions;
create policy vs_insert on public.video_submissions
  for insert to authenticated
  with check (created_by = auth.uid()
              and public.current_app_role() in ('staff','aggregator','admin'));

drop policy if exists vs_update on public.video_submissions;
create policy vs_update on public.video_submissions
  for update to authenticated
  using (created_by = auth.uid()
         or public.current_app_role() in ('aggregator','admin'))
  with check (created_by = auth.uid()
              or public.current_app_role() in ('aggregator','admin'));

drop policy if exists vs_delete on public.video_submissions;
create policy vs_delete on public.video_submissions
  for delete to authenticated
  using (public.current_app_role() = 'admin');

-- macro cho child tables: select theo visibility của submission
do $$
declare
  t text;
  child_tables text[] := array[
    'video_review_jobs','video_extracted_assets','video_content_analysis',
    'facebook_policy_checks','video_creative_scores','video_final_decisions'
  ];
begin
  foreach t in array child_tables loop
    execute format('drop policy if exists %I_select on public.%I', t, t);
    execute format($f$
      create policy %I_select on public.%I
        for select to authenticated
        using (exists (
          select 1 from public.video_submissions s
          where s.id = %I.video_submission_id
            and (s.created_by = auth.uid()
                 or public.current_app_role() in ('accountant','aggregator','admin'))
        ))
    $f$, t, t, t);
  end loop;
end $$;

-- summary: chỉ accountant/aggregator/admin đọc
drop policy if exists vrs_select on public.video_review_summary;
create policy vrs_select on public.video_review_summary
  for select to authenticated
  using (public.current_app_role() in ('accountant','aggregator','admin'));

-- ---------------------------------------------------------------------
-- 8. GRANTS (RLS vẫn là lớp chặn). Service role bypass RLS hoàn toàn.
-- ---------------------------------------------------------------------
grant select, insert, update, delete on public.video_submissions to authenticated;
grant select on public.video_review_jobs        to authenticated;
grant select on public.video_extracted_assets   to authenticated;
grant select on public.video_content_analysis   to authenticated;
grant select on public.facebook_policy_checks   to authenticated;
grant select on public.video_creative_scores    to authenticated;
grant select on public.video_final_decisions    to authenticated;
grant select on public.video_review_summary     to authenticated;
