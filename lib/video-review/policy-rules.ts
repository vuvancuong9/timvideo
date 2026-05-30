/**
 * Mô tả CÔNG KHAI các rule deterministic mà code dùng để ra final_action.
 * Đây chính là logic trong lib/video-review/final-decision.ts (nguồn sự thật),
 * trình bày lại để hiển thị ở /admin/policy-rules. KHÔNG phải config động.
 */
export type PolicyRuleGroup = {
  title: string;
  rules: string[];
};

export const FINAL_DECISION_WEIGHTS = {
  creative_score:
    "hook*0.25 + product_clarity*0.20 + demo*0.20 + trust*0.15 + affiliate_fit*0.10 + remake*0.10",
  final_score: "creative_score*0.55 + policy_safety*0.30 + copyright_safety*0.15",
};

export const FINAL_ACTION_RULES: PolicyRuleGroup[] = [
  {
    title: "Thứ tự quyết định (deterministic, code tự tính)",
    rules: [
      "policy_safety_score < 50 HOẶC final_policy_level = critical → REJECT_POLICY_RISK",
      "copyright_safety_score < 50 HOẶC ip_trademark_risk = critical → REJECT_COPYRIGHT_RISK",
      "policy_safety_score < 70 HOẶC final_policy_level = high → NEED_EDIT",
      "creative ≥ 75 VÀ policy ≥ 75 VÀ copyright ≥ 70 → APPROVE_RUN_ADS",
      "creative ≥ 70 → REMAKE_SAFE",
      "còn lại → LOW_PERFORMANCE",
    ],
  },
  {
    title: "Nhóm rủi ro chính sách được AI chấm (low/medium/high/critical)",
    rules: [
      "misleading_claim_risk — tuyên bố sai/gây hiểu lầm",
      "health_claim_risk — tuyên bố sức khỏe/cơ thể",
      "personal_attribute_risk — nhắm thuộc tính cá nhân",
      "before_after_risk — hình ảnh trước/sau",
      "shocking_content_risk — nội dung gây sốc",
      "adult_sensitive_risk — nội dung nhạy cảm",
      "ip_trademark_risk — bản quyền/logo/người nổi tiếng/nhạc",
      "restricted_product_risk — sản phẩm bị hạn chế",
    ],
  },
  {
    title: "Độ tin cậy (confidence)",
    rules: [
      "Chỉ có link ngoài, KHÔNG có file video → confidence bị giới hạn ở mức ≤ medium.",
      "Có file video upload Drive → cho phép confidence high.",
      "Hệ thống KHÔNG khẳng định chắc chắn Facebook duyệt/không duyệt.",
    ],
  },
];
