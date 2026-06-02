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
    title: "Thứ tự quyết định (deterministic — review/lan tỏa; policy là cổng chặn)",
    rules: [
      "evidence_level ≠ video (chưa xem được video thật) → NEED_EDIT (không tự duyệt)",
      "policy < 50 HOẶC final_policy_level = critical → REJECT_POLICY_RISK",
      "copyright < 50 HOẶC critical (bản quyền/nhạc/UGC/hàng giả) → REJECT_COPYRIGHT_RISK",
      "rủi ro quyền (nhạc/UGC/hàng giả) = high → NEED_RIGHTS_CHECK",
      "is_real_review = false HOẶC sales_deal mà review_depth chưa đủ → REMAKE_AS_REVIEW",
      "review_depth < 40 → REMAKE_AS_REVIEW",
      "policy < 70 HOẶC final_policy_level = high → NEED_EDIT",
      "content_score < 50 → LOW_REVIEW_QUALITY",
      "content_score < 70 HOẶC review_depth < 60 → NEED_EDIT",
      "content ≥ 70 VÀ review_depth ≥ 60 VÀ policy ≥ 75 VÀ copyright ≥ 70 → APPROVE_RUN_ADS",
    ],
  },
];
