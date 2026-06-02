/**
 * Quyết định cuối DETERMINISTIC cho mục tiêu REVIEW / CHIA SẺ / LAN TỎA.
 * Pure function, test trực tiếp (tests/final-decision.test.ts).
 *
 * Nguyên tắc: final_score = content_score (chỉ đo review/viral). Policy & bản quyền
 * là CỔNG CHẶN (hard gate), KHÔNG cộng trung bình để cứu điểm. Chưa xem được video
 * thật (evidence_level != "video") → KHÔNG tự APPROVE.
 */
import type {
  CreativeScoreModelResult,
  FinalDecisionInput,
  FinalDecisionResult,
} from "@/types/videoReview";

/** Ngưỡng + trọng số quyết định (admin chỉnh được, lưu app_settings). */
export type DecisionThresholds = {
  // Trọng số content_score (review/viral)
  w_review_depth: number;
  w_viral_hook: number;
  w_retention: number;
  w_authenticity: number;
  w_product_demo: number;
  w_sales_conversion: number;
  // Cổng policy/bản quyền
  reject_policy_below: number;
  reject_copyright_below: number;
  need_edit_policy_below: number;
  // Cổng review
  review_depth_reject_below: number;
  review_depth_need_edit_below: number;
  // Ngưỡng duyệt
  approve_content_min: number;
  approve_review_depth_min: number;
  approve_policy_min: number;
  approve_copyright_min: number;
  // Ngưỡng chất lượng nội dung
  low_quality_below: number;
  need_edit_content_below: number;
};

export const DEFAULT_THRESHOLDS: DecisionThresholds = {
  w_review_depth: 0.25,
  w_viral_hook: 0.2,
  w_retention: 0.15,
  w_authenticity: 0.15,
  w_product_demo: 0.15,
  w_sales_conversion: 0.1,

  reject_policy_below: 50,
  reject_copyright_below: 50,
  need_edit_policy_below: 70,

  review_depth_reject_below: 40,
  review_depth_need_edit_below: 60,

  approve_content_min: 70,
  approve_review_depth_min: 60,
  approve_policy_min: 75,
  approve_copyright_min: 70,

  low_quality_below: 50,
  need_edit_content_below: 70,
};

/** content_score = tổng có trọng số 6 tiêu chí review/viral. Trả 0..100. */
export function computeContentScore(
  m: CreativeScoreModelResult,
  thresholds: DecisionThresholds = DEFAULT_THRESHOLDS,
): number {
  const t = thresholds;
  const score =
    clamp0to100(m.review_depth_score) * t.w_review_depth +
    clamp0to100(m.viral_hook_score) * t.w_viral_hook +
    clamp0to100(m.retention_score) * t.w_retention +
    clamp0to100(m.authenticity_score) * t.w_authenticity +
    clamp0to100(m.product_demo_score) * t.w_product_demo +
    clamp0to100(m.sales_conversion_score) * t.w_sales_conversion;
  return round2(clamp0to100(score));
}

/** @deprecated Dùng computeContentScore. Giữ cho caller cũ. */
export function computeCreativeScore(m: CreativeScoreModelResult): number {
  return computeContentScore(m);
}

export function decideFinalAction(
  input: FinalDecisionInput,
  thresholds: DecisionThresholds = DEFAULT_THRESHOLDS,
): FinalDecisionResult {
  const t = thresholds;
  const reviewDepth = clamp0to100(input.review_depth_score);
  const policy = clamp0to100(input.policy_safety_score);
  const copyright = clamp0to100(input.copyright_safety_score);

  const contentScore = round2(
    clamp0to100(
      reviewDepth * t.w_review_depth +
        clamp0to100(input.viral_hook_score) * t.w_viral_hook +
        clamp0to100(input.retention_score) * t.w_retention +
        clamp0to100(input.authenticity_score) * t.w_authenticity +
        clamp0to100(input.product_demo_score) * t.w_product_demo +
        clamp0to100(input.sales_conversion_score) * t.w_sales_conversion,
    ),
  );
  const final_score = contentScore;

  // Policy là CỔNG CHẶN. copyright/rights gộp critical từ field + nhóm động.
  const policyCritical =
    Boolean(input.policy_critical_block) || input.final_policy_level === "critical";
  const copyrightCritical =
    Boolean(input.copyright_critical_block) ||
    input.ip_trademark_risk === "critical" ||
    input.music_copyright_risk === "critical" ||
    input.ugc_reupload_risk === "critical" ||
    input.counterfeit_risk === "critical";
  const rightsHigh =
    input.music_copyright_risk === "high" ||
    input.ugc_reupload_risk === "high" ||
    input.counterfeit_risk === "high";

  const blocking_reasons: string[] = [];
  const required_edits: string[] = [];
  let final_action: FinalDecisionResult["final_action"];
  let decision_reason: string;

  if (input.evidence_level !== "video") {
    final_action = "NEED_EDIT";
    decision_reason =
      "Chưa có bằng chứng video thật để chấm chính xác; không được duyệt chạy ads tự động.";
    blocking_reasons.push(`evidence_level=${input.evidence_level}`);
    required_edits.push(
      "Upload file video thật (hoặc link video public AI đọc được) để chấm lại.",
    );
  } else if (policy < t.reject_policy_below || policyCritical) {
    final_action = "REJECT_POLICY_RISK";
    decision_reason = "Rủi ro chính sách quá cao.";
    if (policy < t.reject_policy_below)
      blocking_reasons.push(`policy_safety_score=${policy} < ${t.reject_policy_below}`);
    if (policyCritical) blocking_reasons.push("policy_risk=critical");
  } else if (copyright < t.reject_copyright_below || copyrightCritical) {
    final_action = "REJECT_COPYRIGHT_RISK";
    decision_reason = "Rủi ro bản quyền/nhạc/UGC/thương hiệu quá cao.";
    if (copyright < t.reject_copyright_below)
      blocking_reasons.push(
        `copyright_safety_score=${copyright} < ${t.reject_copyright_below}`,
      );
    if (copyrightCritical) blocking_reasons.push("rights_risk=critical");
  } else if (rightsHigh) {
    final_action = "NEED_RIGHTS_CHECK";
    decision_reason =
      "Cần kiểm tra quyền sử dụng video/nhạc/nguồn hàng trước khi chạy.";
    required_edits.push(
      "Xác minh quyền dùng video/nhạc/UGC/thương hiệu hoặc remake bằng nội dung tự quay.",
    );
  } else if (input.is_real_review === false) {
    final_action = "REMAKE_AS_REVIEW";
    decision_reason =
      "Video chưa phải review/chia sẻ thật; đang giống video bán hàng hoặc săn deal.";
    blocking_reasons.push("is_real_review=false");
    required_edits.push(
      "Remake thành review thật: test/swatch/demo, cảm nhận ưu-nhược điểm, kết luận hợp với ai.",
    );
  } else if (
    input.video_type === "sales_deal" &&
    reviewDepth < t.approve_review_depth_min
  ) {
    final_action = "REMAKE_AS_REVIEW";
    decision_reason = "Video là dạng sales deal, chưa đủ độ sâu review.";
    blocking_reasons.push("video_type=sales_deal");
    required_edits.push("Thêm cảnh dùng thử/demo và nhận xét thật thay vì chỉ hiện giá.");
  } else if (reviewDepth < t.review_depth_reject_below) {
    final_action = "REMAKE_AS_REVIEW";
    decision_reason = "Độ sâu review quá thấp.";
    blocking_reasons.push(
      `review_depth_score=${reviewDepth} < ${t.review_depth_reject_below}`,
    );
    required_edits.push("Quay/dựng lại theo format review chia sẻ.");
  } else if (policy < t.need_edit_policy_below || input.final_policy_level === "high") {
    final_action = "NEED_EDIT";
    decision_reason = "Còn rủi ro chính sách mức cao, cần chỉnh sửa claim/nội dung.";
    required_edits.push("Giảm claim quá đà, sửa giá/CTA, tránh nhắm thuộc tính cá nhân.");
  } else if (contentScore < t.low_quality_below) {
    final_action = "LOW_REVIEW_QUALITY";
    decision_reason = "Nội dung review/viral yếu, không nên ưu tiên.";
    blocking_reasons.push(`content_score=${contentScore} < ${t.low_quality_below}`);
  } else if (
    contentScore < t.need_edit_content_below ||
    reviewDepth < t.review_depth_need_edit_below
  ) {
    final_action = "NEED_EDIT";
    decision_reason =
      "Có thể dùng nhưng cần chỉnh để tăng độ sâu review / giữ chân người xem.";
    required_edits.push("Tăng hook, demo thực tế, cảm nhận thật, payoff cuối video.");
  } else if (
    contentScore >= t.approve_content_min &&
    reviewDepth >= t.approve_review_depth_min &&
    policy >= t.approve_policy_min &&
    copyright >= t.approve_copyright_min
  ) {
    final_action = "APPROVE_RUN_ADS";
    decision_reason = "Video đủ chất lượng review/lan tỏa và đạt ngưỡng an toàn.";
  } else {
    final_action = "NEED_EDIT";
    decision_reason = "Chưa đạt đủ ngưỡng duyệt, cần chỉnh sửa.";
    required_edits.push("Tối ưu lại nội dung review và kiểm tra policy.");
  }

  return {
    creative_score: contentScore,
    content_score: contentScore,
    review_depth_score: reviewDepth,
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
