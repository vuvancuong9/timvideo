/**
 * Quyết định cuối DETERMINISTIC — KHÔNG tin model quyết định cuối.
 * Pure function, được test trực tiếp (tests/final-decision.test.ts).
 */
import type {
  CreativeScoreModelResult,
  FinalDecisionInput,
  FinalDecisionResult,
} from "@/types/videoReview";

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

export function decideFinalAction(input: FinalDecisionInput): FinalDecisionResult {
  const creative = clamp0to100(input.creative_score);
  const policy = clamp0to100(input.policy_safety_score);
  const copyright = clamp0to100(input.copyright_safety_score);

  const final_score = round2(creative * 0.55 + policy * 0.3 + copyright * 0.15);

  const blocking_reasons: string[] = [];
  const required_edits: string[] = [];
  let final_action: FinalDecisionResult["final_action"];
  let decision_reason: string;

  if (policy < 50 || input.final_policy_level === "critical") {
    final_action = "REJECT_POLICY_RISK";
    decision_reason =
      "Điểm an toàn chính sách quá thấp hoặc mức rủi ро chính sách ở mức critical.";
    if (policy < 50) blocking_reasons.push(`policy_safety_score=${policy} < 50`);
    if (input.final_policy_level === "critical")
      blocking_reasons.push("final_policy_level=critical");
  } else if (copyright < 50 || input.ip_trademark_risk === "critical") {
    final_action = "REJECT_COPYRIGHT_RISK";
    decision_reason =
      "Điểm an toàn bản quyền quá thấp hoặc rủi ro IP/thương hiệu ở mức critical.";
    if (copyright < 50)
      blocking_reasons.push(`copyright_safety_score=${copyright} < 50`);
    if (input.ip_trademark_risk === "critical")
      blocking_reasons.push("ip_trademark_risk=critical");
  } else if (policy < 70 || input.final_policy_level === "high") {
    final_action = "NEED_EDIT";
    decision_reason =
      "Còn rủi ро chính sách mức cao — cần chỉnh sửa trước khi chạy ads.";
    required_edits.push("Giảm/loại bỏ các claim rủi ro theo gợi ý policy.");
  } else if (creative >= 75 && policy >= 75 && copyright >= 70) {
    final_action = "APPROVE_RUN_ADS";
    decision_reason =
      "Điểm sáng tạo và an toàn đều cao — đề xuất chạy ads (vẫn cần người duyệt cuối).";
  } else if (creative >= 70) {
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
