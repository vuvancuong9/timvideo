/**
 * Quyết định cuối DETERMINISTIC — KHÔNG tin model quyết định cuối.
 * Pure function, được test trực tiếp (tests/final-decision.test.ts).
 */
import type {
  CreativeScoreModelResult,
  FinalDecisionInput,
  FinalDecisionResult,
} from "@/types/videoReview";

/** Ngưỡng + trọng số quyết định (admin chỉnh được, lưu app_settings). */
export type DecisionThresholds = {
  // Trọng số final_score
  w_creative: number;
  w_policy: number;
  w_copyright: number;
  // Ngưỡng các nhánh quyết định
  reject_policy_below: number; // policy < X -> REJECT_POLICY_RISK
  reject_copyright_below: number; // copyright < X -> REJECT_COPYRIGHT_RISK
  need_edit_policy_below: number; // policy < X -> NEED_EDIT
  approve_creative_min: number; // creative >= X
  approve_policy_min: number; // policy >= X
  approve_copyright_min: number; // copyright >= X
  remake_creative_min: number; // creative >= X -> REMAKE_SAFE
};

/** Giá trị mặc định = đúng logic gốc (giữ nguyên hành vi cũ). */
export const DEFAULT_THRESHOLDS: DecisionThresholds = {
  w_creative: 0.55,
  w_policy: 0.3,
  w_copyright: 0.15,
  reject_policy_below: 50,
  reject_copyright_below: 50,
  need_edit_policy_below: 70,
  approve_creative_min: 75,
  approve_policy_min: 75,
  approve_copyright_min: 70,
  remake_creative_min: 70,
};

/** creative_score = trọng số có sẵn theo spec. Trả về 0..100. */
export function computeCreativeScore(m: CreativeScoreModelResult): number {
  const score =
    m.hook_score * 0.25 +
    m.product_clarity_score * 0.2 +
    m.demo_score * 0.2 +
    m.trust_score * 0.15 +
    m.affiliate_fit_score * 0.1 +
    m.remake_score * 0.1;
  return round2(clamp0to100(score));
}

export function decideFinalAction(
  input: FinalDecisionInput,
  thresholds: DecisionThresholds = DEFAULT_THRESHOLDS,
): FinalDecisionResult {
  const t = thresholds;
  const creative = clamp0to100(input.creative_score);
  const policy = clamp0to100(input.policy_safety_score);
  const copyright = clamp0to100(input.copyright_safety_score);

  const final_score = round2(
    creative * t.w_creative + policy * t.w_policy + copyright * t.w_copyright,
  );

  const blocking_reasons: string[] = [];
  const required_edits: string[] = [];
  let final_action: FinalDecisionResult["final_action"];
  let decision_reason: string;

  if (policy < t.reject_policy_below || input.final_policy_level === "critical") {
    final_action = "REJECT_POLICY_RISK";
    decision_reason =
      "Điểm an toàn chính sách quá thấp hoặc mức rủi ро chính sách ở mức critical.";
    if (policy < t.reject_policy_below)
      blocking_reasons.push(`policy_safety_score=${policy} < ${t.reject_policy_below}`);
    if (input.final_policy_level === "critical")
      blocking_reasons.push("final_policy_level=critical");
  } else if (
    copyright < t.reject_copyright_below ||
    input.ip_trademark_risk === "critical"
  ) {
    final_action = "REJECT_COPYRIGHT_RISK";
    decision_reason =
      "Điểm an toàn bản quyền quá thấp hoặc rủi ro IP/thương hiệu ở mức critical.";
    if (copyright < t.reject_copyright_below)
      blocking_reasons.push(
        `copyright_safety_score=${copyright} < ${t.reject_copyright_below}`,
      );
    if (input.ip_trademark_risk === "critical")
      blocking_reasons.push("ip_trademark_risk=critical");
  } else if (
    policy < t.need_edit_policy_below ||
    input.final_policy_level === "high"
  ) {
    final_action = "NEED_EDIT";
    decision_reason =
      "Còn rủi ро chính sách mức cao — cần chỉnh sửa trước khi chạy ads.";
    required_edits.push("Giảm/loại bỏ các claim rủi ro theo gợi ý policy.");
  } else if (
    creative >= t.approve_creative_min &&
    policy >= t.approve_policy_min &&
    copyright >= t.approve_copyright_min
  ) {
    final_action = "APPROVE_RUN_ADS";
    decision_reason =
      "Điểm sáng tạo và an toàn đều cao — đề xuất chạy ads (vẫn cần người duyệt cuối).";
  } else if (creative >= t.remake_creative_min) {
    final_action = "REMAKE_SAFE";
    decision_reason =
      "Tiềm năng bán hàng tốt nhưng nên remake bản an toàn hơn để tối ưu duyệt.";
    required_edits.push("Remake theo các remake_angles được đề xuất.");
  } else {
    final_action = "LOW_PERFORMANCE";
    decision_reason =
      "Điểm sáng tạo/bán hàng thấp — không ưu tiên chạy ads.";
  }

  return {
    creative_score: creative,
    policy_safety_score: policy,
    copyright_safety_score: copyright,
    final_score,
    final_action,
    decision_reason,
    blocking_reasons,
    required_edits,
  };
}

function clamp0to100(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
