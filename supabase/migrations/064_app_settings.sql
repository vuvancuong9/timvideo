-- =====================================================================
--  timvideo - 064_app_settings
--  DB-backed secrets/config quản lý qua UI admin (API keys, Google Sheet ID…).
--
--  BẢO MẬT:
--  - RLS bật + KHÔNG tạo policy cho authenticated/anon → chỉ `service_role`
--    (bypass RLS) đọc/ghi được. Client KHÔNG bao giờ query trực tiếp bảng này.
--  - Mọi thao tác đi qua API admin-guarded (requireApi(['admin'])).
--  - Giá trị secret KHÔNG trả về client dạng thô (UI chỉ thấy preview che).
--
--  LƯU Ý: KHÔNG lưu SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_* /
--  ADMIN_EMAILS vào đây — chúng phải nằm ở env Vercel vì cần để kết nối DB
--  trước khi đọc được bảng này.
-- =====================================================================
create table if not exists public.app_settings (
  key text primary key,
  value text,
  is_secret boolean not null default false,
  description text,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;
revoke all on public.app_settings from anon, authenticated;
-- cố ý không tạo policy: service_role bypass RLS, client bị chặn hoàn toàn.
