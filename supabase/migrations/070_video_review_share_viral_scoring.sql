-- 070_video_review_share_viral_scoring.sql
-- Chuyển hệ chấm video từ "bán hàng/policy" sang "review chia sẻ lan tỏa".
-- Additive: thêm enum action + cột mới (giữ nguyên dữ liệu cũ). Cột rủi ro mới
-- được dual-write từ risk_scores (nhóm rủi ro động), giống 8 cột legacy.

-- 1) Action mới
alter type public.video_final_action add value if not exists 'REMAKE_AS_REVIEW';
alter type public.video_final_action add value if not exists 'LOW_REVIEW_QUALITY';
alter type public.video_final_action add value if not exists 'NEED_RIGHTS_CHECK';

-- 2) video_content_analysis: phân loại + bằng chứng
alter table public.video_content_analysis
  add column if not exists objective text not null default 'review_share_viral',
  add column if not exists evidence_level text not null default 'text_only'
    check (evidence_level in ('video','frames','images_only','text_only')),
  add column if not exists video_type text not null default 'unknown'
    check (video_type in ('review','sales_deal','unboxing','demo','comparison','testimonial','unknown')),
  add column if not exists is_real_review boolean not null default false,
  add column if not exists video_seen boolean not null default false,
  add column if not exists observed_evidence jsonb not null default '[]'::jsonb,
  add column if not exists expert_diagnosis jsonb not null default '{}'::jsonb;

-- 3) facebook_policy_checks: tách rủi ro thương hiệu/bản quyền/giá
alter table public.facebook_policy_checks
  add column if not exists misleading_price_risk public.risk_level not null default 'low',
  add column if not exists brand_visible_warning public.risk_level not null default 'low',
  add column if not exists counterfeit_risk public.risk_level not null default 'low',
  add column if not exists music_copyright_risk public.risk_level not null default 'low',
  add column if not exists ugc_reupload_risk public.risk_level not null default 'low';

-- 4) video_creative_scores: review/viral score
alter table public.video_creative_scores
  add column if not exists review_depth_score numeric not null default 0,
  add column if not exists product_demo_score numeric not null default 0,
  add column if not exists authenticity_score numeric not null default 0,
  add column if not exists viral_hook_score numeric not null default 0,
  add column if not exists retention_score numeric not null default 0,
  add column if not exists shareability_score numeric not null default 0,
  add column if not exists sales_conversion_score numeric not null default 0,
  add column if not exists production_quality_score numeric not null default 0,
  add column if not exists content_score numeric not null default 0;

-- 5) video_final_decisions
alter table public.video_final_decisions
  add column if not exists review_depth_score numeric not null default 0,
  add column if not exists content_score numeric not null default 0,
  add column if not exists evidence_level text not null default 'text_only',
  add column if not exists video_type text not null default 'unknown',
  add column if not exists is_real_review boolean not null default false;

-- 6) indexes
create index if not exists idx_video_content_analysis_evidence_level on public.video_content_analysis (evidence_level);
create index if not exists idx_video_content_analysis_video_type on public.video_content_analysis (video_type);
create index if not exists idx_video_creative_scores_review_depth on public.video_creative_scores (review_depth_score);
create index if not exists idx_video_creative_scores_content_score on public.video_creative_scores (content_score);

notify pgrst, 'reload schema';
