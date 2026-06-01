-- 067: them cot ten san pham cho video_submissions.
-- Nullable o DB de cac video cu (truoc khi co truong nay) khong vo;
-- rang buoc "bat buoc" duoc ap o tang app (form + submission-service).
alter table public.video_submissions
  add column if not exists product_name text;

comment on column public.video_submissions.product_name is
  'Ten san pham nhan vien nhap (bat buoc o app, nullable o DB cho du lieu cu).';
