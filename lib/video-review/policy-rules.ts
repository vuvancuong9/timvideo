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
      "copyright_safety_score < 50 HOẶC nhóm copyright (critical ⇒ chặn) = critical → REJECT_COPYRIGHT_RISK",
      "policy_safety_score < 70 HOẶC final_policy_level = high → NEED_EDIT",
      "creative ≥ 75 VÀ policy ≥ 75 VÀ copyright ≥ 70 → APPROVE_RUN_ADS",
      "creative ≥ 70 → REMAKE_SAFE",
      "còn lại → LOW_PERFORMANCE",
    ],
  },
];
