-- 069: Lưu điểm rủi ro chính sách theo nhóm ĐỘNG (admin cấu hình được) dạng jsonb.
-- Trước đây mỗi nhóm rủi ro là 1 cột risk_level cố định trên facebook_policy_checks.
-- Khi cho admin thêm/xóa/đổi tên nhóm, cần lưu map {key -> level} linh hoạt.
-- Additive + idempotent: giữ nguyên 8 cột cũ (back-compat), chỉ THÊM cột risk_scores
-- và backfill từ cột cũ cho các row đã có.

alter table public.facebook_policy_checks
  add column if not exists risk_scores jsonb not null default '{}'::jsonb;

update public.facebook_policy_checks set risk_scores = jsonb_build_object(
  'misleading_claim_risk', misleading_claim_risk::text,
  'health_claim_risk', health_claim_risk::text,
  'personal_attribute_risk', personal_attribute_risk::text,
  'before_after_risk', before_after_risk::text,
  'shocking_content_risk', shocking_content_risk::text,
  'adult_sensitive_risk', adult_sensitive_risk::text,
  'ip_trademark_risk', ip_trademark_risk::text,
  'restricted_product_risk', restricted_product_risk::text)
where risk_scores = '{}'::jsonb;

notify pgrst, 'reload schema';
