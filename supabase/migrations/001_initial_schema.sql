-- =====================================================================
--  timvideo - 001_initial_schema
--  Enums, tables, indexes, helper functions, RLS policies & triggers.
--  Idempotent: an toàn khi chạy lại nhiều lần.
-- =====================================================================

-- ---------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------
do $$ begin
  create type public.user_role as enum ('staff', 'accountant', 'aggregator', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.video_source as enum ('facebook', 'tiktok', 'youtube', 'other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.video_status as enum ('draft', 'submitted', 'assigned', 'short_linked', 'rejected', 'archived');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- TABLES
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text unique not null,
  full_name   text,
  role        public.user_role not null default 'staff',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.product_categories (
  id          uuid primary key default gen_random_uuid(),
  name        text unique not null,
  description text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists public.affiliate_accounts (
  id         uuid primary key default gen_random_uuid(),
  code       text unique not null,
  name       text not null,
  platform   text not null default 'shopee',
  note       text,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.video_submissions (
  id                            uuid primary key default gen_random_uuid(),
  created_by                    uuid not null references public.profiles(id),
  shopee_product_url            text not null,
  product_price                 numeric(18,2) not null,
  commission_percent            numeric(6,2) not null,
  estimated_commission          numeric(18,2),
  video_source                  public.video_source not null,
  video_url                     text not null,
  canonical_video_url           text not null,
  canonical_video_hash          text not null,
  category_id                   uuid references public.product_categories(id),
  drive_file_id                 text,
  drive_file_name               text,
  drive_web_url                 text,
  drive_folder_id               text,
  assigned_affiliate_account_id uuid references public.affiliate_accounts(id),
  assigned_by                   uuid references public.profiles(id),
  assigned_at                   timestamptz,
  short_link                    text,
  short_link_by                 uuid references public.profiles(id),
  short_link_at                 timestamptz,
  status                        public.video_status not null default 'submitted',
  staff_note                    text,
  aggregate_note                text,
  admin_note                    text,
  created_at                    timestamptz not null default now(),
  updated_at                    timestamptz not null default now()
);

create table if not exists public.sales_records (
  id                   uuid primary key default gen_random_uuid(),
  employee_id          uuid not null references public.profiles(id),
  video_submission_id  uuid references public.video_submissions(id),
  date                 date not null,
  clicks               integer not null default 0,
  orders               integer not null default 0,
  revenue              numeric(18,2) not null default 0,
  commission           numeric(18,2) not null default 0,
  source               text,
  created_at           timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references public.profiles(id),
  action      text not null,
  entity_type text not null,
  entity_id   uuid,
  before_data jsonb,
  after_data  jsonb,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- INDEXES
-- ---------------------------------------------------------------------
-- Unique index quyết định chống trùng video theo canonical hash.
create unique index if not exists ux_video_submissions_canonical_hash
  on public.video_submissions (canonical_video_hash);
create index if not exists idx_video_submissions_created_by
  on public.video_submissions (created_by);
create index if not exists idx_video_submissions_affiliate
  on public.video_submissions (assigned_affiliate_account_id);
create index if not exists idx_video_submissions_category
  on public.video_submissions (category_id);
create index if not exists idx_sales_records_employee_date
  on public.sales_records (employee_id, date);
create index if not exists idx_audit_logs_actor_created
  on public.audit_logs (actor_id, created_at);

-- ---------------------------------------------------------------------
-- HELPER FUNCTIONS
-- ---------------------------------------------------------------------
-- Lấy role của user hiện tại. SECURITY DEFINER => chạy với quyền owner
-- (owner bỏ qua RLS của chính bảng nó sở hữu) nên không bị đệ quy RLS.
create or replace function public.current_app_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

grant execute on function public.current_app_role() to anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- TRIGGER: chặn sửa cấp cột trên video_submissions
--   - service_role (server tin cậy) bỏ qua kiểm tra
--   - admin: toàn quyền
--   - aggregator: chỉ được sửa assign + status + aggregate_note + drive*
--   - các role khác: chặn (RLS cũng đã chặn)
-- ---------------------------------------------------------------------
create or replace function public.enforce_video_update()
returns trigger
language plpgsql
security definer
set search_path = public
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
    null; -- toàn quyền
  elsif r = 'aggregator' then
    if new.short_link            is distinct from old.short_link
    or new.short_link_by         is distinct from old.short_link_by
    or new.short_link_at         is distinct from old.short_link_at
    or new.shopee_product_url    is distinct from old.shopee_product_url
    or new.product_price         is distinct from old.product_price
    or new.commission_percent    is distinct from old.commission_percent
    or new.estimated_commission  is distinct from old.estimated_commission
    or new.video_url             is distinct from old.video_url
    or new.canonical_video_url   is distinct from old.canonical_video_url
    or new.canonical_video_hash  is distinct from old.canonical_video_hash
    or new.created_by            is distinct from old.created_by then
      raise exception 'AGGREGATOR_FIELD_FORBIDDEN: Tong hop khong duoc sua truong nay (short_link / gia / link goc / nguoi tao)';
    end if;
  else
    raise exception 'FORBIDDEN_UPDATE: Role nay khong duoc sua video';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_enforce_video_update on public.video_submissions;
create trigger trg_enforce_video_update
  before update on public.video_submissions
  for each row execute function public.enforce_video_update();

-- ---------------------------------------------------------------------
-- TRIGGER: chặn đổi role/is_active/email nếu không phải admin
-- ---------------------------------------------------------------------
create or replace function public.enforce_profile_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.user_role;
begin
  if coalesce(auth.role(), '') = 'service_role' then
    new.updated_at := now();
    return new;
  end if;

  r := public.current_app_role();

  if (new.role      is distinct from old.role
   or new.is_active is distinct from old.is_active
   or new.email     is distinct from old.email)
   and coalesce(r, 'staff') <> 'admin' then
    raise exception 'ROLE_CHANGE_FORBIDDEN: Chi admin duoc doi role/trang thai/email';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_enforce_profile_update on public.profiles;
create trigger trg_enforce_profile_update
  before update on public.profiles
  for each row execute function public.enforce_profile_update();

-- ---------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ---------------------------------------------------------------------
alter table public.profiles            enable row level security;
alter table public.product_categories  enable row level security;
alter table public.affiliate_accounts  enable row level security;
alter table public.video_submissions   enable row level security;
alter table public.sales_records       enable row level security;
alter table public.audit_logs          enable row level security;

-- ----- profiles -----
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.current_app_role() in ('accountant', 'aggregator', 'admin'));

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.current_app_role() = 'admin')
  with check (id = auth.uid() or public.current_app_role() = 'admin');

-- ----- product_categories -----
drop policy if exists categories_select on public.product_categories;
create policy categories_select on public.product_categories
  for select to authenticated
  using (true);

drop policy if exists categories_write on public.product_categories;
create policy categories_write on public.product_categories
  for all to authenticated
  using (public.current_app_role() = 'admin')
  with check (public.current_app_role() = 'admin');

-- ----- affiliate_accounts -----
drop policy if exists affiliate_select on public.affiliate_accounts;
create policy affiliate_select on public.affiliate_accounts
  for select to authenticated
  using (public.current_app_role() in ('accountant', 'aggregator', 'admin'));

drop policy if exists affiliate_write on public.affiliate_accounts;
create policy affiliate_write on public.affiliate_accounts
  for all to authenticated
  using (public.current_app_role() = 'admin')
  with check (public.current_app_role() = 'admin');

-- ----- video_submissions -----
drop policy if exists videos_select on public.video_submissions;
create policy videos_select on public.video_submissions
  for select to authenticated
  using (created_by = auth.uid() or public.current_app_role() in ('accountant', 'aggregator', 'admin'));

drop policy if exists videos_insert on public.video_submissions;
create policy videos_insert on public.video_submissions
  for insert to authenticated
  with check (created_by = auth.uid() and public.current_app_role() in ('staff', 'admin'));

-- Chỉ aggregator + admin được UPDATE (cấp cột do trigger enforce_video_update kiểm soát).
-- staff & accountant bị chặn hoàn toàn ở tầng RLS.
drop policy if exists videos_update on public.video_submissions;
create policy videos_update on public.video_submissions
  for update to authenticated
  using (public.current_app_role() in ('aggregator', 'admin'))
  with check (public.current_app_role() in ('aggregator', 'admin'));

drop policy if exists videos_delete on public.video_submissions;
create policy videos_delete on public.video_submissions
  for delete to authenticated
  using (public.current_app_role() = 'admin');

-- ----- sales_records -----
drop policy if exists sales_select on public.sales_records;
create policy sales_select on public.sales_records
  for select to authenticated
  using (employee_id = auth.uid() or public.current_app_role() in ('accountant', 'admin'));

drop policy if exists sales_write on public.sales_records;
create policy sales_write on public.sales_records
  for all to authenticated
  using (public.current_app_role() = 'admin')
  with check (public.current_app_role() = 'admin');

-- ----- audit_logs (chỉ admin đọc; ghi qua service_role) -----
drop policy if exists audit_select on public.audit_logs;
create policy audit_select on public.audit_logs
  for select to authenticated
  using (public.current_app_role() = 'admin');

-- ---------------------------------------------------------------------
-- GRANTS (RLS vẫn là lớp chặn cuối cùng)
-- ---------------------------------------------------------------------
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on public.product_categories to anon;
