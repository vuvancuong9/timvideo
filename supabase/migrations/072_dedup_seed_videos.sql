-- 072: Kho "video đã làm trước đó" để lọc trùng (seed từ 13 Google Sheet lịch sử).
-- KHÔNG nhét vào video_submissions (tránh loạn dashboard/Sheet/Sub ID). Chỉ giữ
-- khóa định danh: video_external_id (platform:id) + canonical_video_hash. Lúc
-- kiểm tra trùng, app tra THÊM bảng này ngoài video_submissions.

create table if not exists public.dedup_seed_videos (
  id uuid primary key default gen_random_uuid(),
  video_external_id text,
  canonical_video_hash text not null,
  source text,
  created_at timestamptz not null default now()
);

create unique index if not exists ux_dedup_seed_external_id
  on public.dedup_seed_videos (video_external_id)
  where video_external_id is not null;

create index if not exists idx_dedup_seed_canonical_hash
  on public.dedup_seed_videos (canonical_video_hash);

-- Chỉ server tin cậy (service_role, bypass RLS) đọc/ghi. Bật RLS + không policy
-- => anon/authenticated không truy cập được.
alter table public.dedup_seed_videos enable row level security;
grant select, insert, update, delete on public.dedup_seed_videos to service_role;
