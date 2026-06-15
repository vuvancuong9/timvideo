-- 071: Chống trùng video theo ID gốc (platform:id) — Bậc 1.
-- Khóa định danh video gốc mạnh hơn canonical URL hash: cùng MỘT video (dù URL
-- khác định dạng, đổi @username, hay qua link rút gọn đã resolve ở app) sẽ có
-- cùng video_external_id -> unique index chặn trùng ngay ở tầng DB (chống race).
-- Vẫn GIỮ ux_video_submissions_canonical_hash làm lớp dự phòng cho URL khác nền tảng.

alter table public.video_submissions
  add column if not exists video_external_id text;

comment on column public.video_submissions.video_external_id is
  'Khóa định danh video gốc dạng platform:id (tiktok:/facebook:/youtube:). Null khi không trích được ID; lúc đó chống trùng dựa trên canonical_video_hash.';

-- Backfill từ original_video_url. Chỉ gán cho hàng SỚM NHẤT mỗi external_id
-- (row_number = 1) để KHÔNG BAO GIỜ vỡ unique index nếu lỡ có dữ liệu trùng sẵn.
-- Bảng có trigger enforce_video_submission_update chặn UPDATE khi không có app
-- role -> giả role service_role bằng set_config local (chỉ trong transaction
-- của DO block) để trigger cho qua như server tin cậy.
do $$
begin
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  with cand as (
    select id, created_at,
      coalesce(
        case when original_video_url ~* 'tiktok\.com/(?:@[^/]+/)?(?:video|photo|v)/\d+'
             then 'tiktok:' || substring(original_video_url from 'tiktok\.com/(?:@[^/]+/)?(?:video|photo|v)/(\d+)') end,
        case when original_video_url ~* 'facebook\.com' and original_video_url ~* '[?&]v=\d+'
             then 'facebook:' || substring(original_video_url from '[?&]v=(\d+)') end,
        case when original_video_url ~* 'facebook\.com' and original_video_url ~* '[?&]story_fbid=\d+'
             then 'facebook:' || substring(original_video_url from '[?&]story_fbid=(\d+)') end,
        case when original_video_url ~* 'facebook\.com/(?:reels?|videos?|watch)/\d+'
             then 'facebook:' || substring(original_video_url from 'facebook\.com/(?:reels?|videos?|watch)/(\d+)') end,
        case when original_video_url ~* 'youtube\.com' and original_video_url ~* '[?&]v=[\w-]+'
             then 'youtube:' || substring(original_video_url from '[?&]v=([\w-]+)') end,
        case when original_video_url ~* 'youtu\.be/[\w-]+'
             then 'youtube:' || substring(original_video_url from 'youtu\.be/([\w-]+)') end,
        case when original_video_url ~* 'youtube\.com/(?:shorts|embed|v|live)/[\w-]+'
             then 'youtube:' || substring(original_video_url from 'youtube\.com/(?:shorts|embed|v|live)/([\w-]+)') end
      ) as ext
    from public.video_submissions
  ), ranked as (
    select id, ext, row_number() over (partition by ext order by created_at, id) as rn
    from cand
    where ext is not null
  )
  update public.video_submissions v
  set video_external_id = r.ext
  from ranked r
  where v.id = r.id and r.rn = 1;
end $$;

-- Unique index chống trùng theo ID video gốc (partial: bỏ qua null).
create unique index if not exists ux_video_submissions_external_id
  on public.video_submissions (video_external_id)
  where video_external_id is not null;
