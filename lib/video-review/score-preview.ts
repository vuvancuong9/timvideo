/**
 * Chấm điểm video ĐỒNG BỘ để xem trước (preview) — KHÔNG ghi DB.
 * Dùng bởi POST /api/video-review/preview khi nhân viên bấm "Chấm điểm thử ngay".
 *
 * Lưu ý: luồng submit chính thức VẪN bất đồng bộ (tạo job, worker nền xử lý).
 * Đây là tính năng on-demand do người dùng yêu cầu để biết nhanh video thế nào.
 * Server-only.
 */
import { analyzeContentWithGemini } from "@/lib/video-review/gemini-analyze";
import { checkPolicyWithOpenAI } from "@/lib/video-review/openai-policy";
import { scoreCreativeWithOpenAI } from "@/lib/video-review/openai-creative-score";
import {
  computeContentScore,
  decideFinalAction,
} from "@/lib/video-review/final-decision";
import { getThresholds } from "@/lib/video-review/policy-config";
import { getEnabledRiskGroups } from "@/lib/video-review/policy-groups-config";
import { resolveVideoInput } from "@/lib/video-review/gemini-video-input";
import { getGeminiConfig } from "@/lib/secrets";
import { loadImagePartsFromAttachments } from "@/lib/video-review/images";
import type {
  ContentAnalysisResult,
  PolicyCheckResult,
  CreativeScoreModelResult,
  FinalDecisionResult,
} from "@/types/videoReview";
import type { SubmissionAttachment } from "@/types/videoIntake";

export type PreviewInput = {
  shopeeProductUrl: string;
  productPrice: number;
  commissionPercent: number;
  categoryName: string | null;
  sourceType: string;
  videoUrl: string | null;
  driveWebUrl: string | null;
  hasVideoFile: boolean;
  attachments?: SubmissionAttachment[] | null;
};

export type PreviewResult = {
  analysis: ContentAnalysisResult;
  policy: PolicyCheckResult;
  creative: CreativeScoreModelResult & { creative_score: number };
  decision: FinalDecisionResult;
};

export async function scoreVideoPreview(
  input: PreviewInput,
): Promise<PreviewResult> {
  // Nạp ảnh đính kèm (vd ảnh chụp like/view/comment) để Gemini đọc số liệu.
  const imageParts = await loadImagePartsFromAttachments(input.attachments);

  // Preview đồng bộ (ngân sách ~45s): chỉ YouTube + inline; video lớn → bỏ qua
  // (bản đầy đủ sẽ phân tích video ở worker nền). KHÔNG dùng Files API ở đây.
  const { apiKey: geminiKey } = await getGeminiConfig();
  const video = await resolveVideoInput({
    sourceType: input.sourceType,
    originalVideoUrl: input.videoUrl,
    driveWebUrl: input.driveWebUrl,
    attachments: input.attachments ?? [],
    apiKey: geminiKey ?? "",
    deadlineAt: Date.now() + 45_000,
    allowFilesApi: false,
    inlineDisallowed: imageParts.length > 0,
  });

  // STAGE: ANALYZE (Gemini) — gửi video thật nếu có; KHÔNG bịa transcript/OCR.
  const analysis = await analyzeContentWithGemini(
    {
      productCategory: input.categoryName,
      shopeeProductUrl: input.shopeeProductUrl,
      productPrice: input.productPrice,
      commissionPercent: input.commissionPercent,
      sourceType: input.sourceType,
      videoUrl: input.videoUrl,
      driveWebUrl: input.driveWebUrl,
      transcript: null,
      ocrText: null,
      frameCount: 0,
      imageCount: imageParts.length,
      hasVideoFile: input.hasVideoFile,
      videoProvided: video.videoSeenSent,
      evidenceLevel: (video.videoSeenSent
        ? "video"
        : imageParts.length > 0
          ? "images_only"
          : "text_only") as "video" | "frames" | "images_only" | "text_only",
      videoSeen: video.videoSeenSent,
      videoInputWarnings: video.warning ? [video.warning] : [],
    },
    { videoPart: video.part, imageParts },
  );
  const videoSeen = analysis.result.evidence_level === "video";

  // STAGE: POLICY (OpenAI)
  const policy = await checkPolicyWithOpenAI({
    productCategory: input.categoryName,
    shopeeProductUrl: input.shopeeProductUrl,
    visualSummary: analysis.result.visual_summary,
    transcript: null,
    ocrText: null,
    claimsDetected: analysis.result.claims_detected,
    metadataNote: videoSeen
      ? "Đã phân tích video thật."
      : "Chưa có video thật (chỉ link/ảnh) — đánh giá sơ bộ.",
    hasVideoFile: videoSeen,
  });

  // STAGE: CREATIVE (OpenAI) — điểm review/viral; content_score do code tính.
  const creative = await scoreCreativeWithOpenAI({
    productCategory: input.categoryName,
    shopeeProductUrl: input.shopeeProductUrl,
    productPrice: input.productPrice,
    commissionPercent: input.commissionPercent,
    summary: analysis.result.summary,
    hook3s: analysis.result.hook_3s,
    visualSummary: analysis.result.visual_summary,
    transcript: null,
    hasVideoFile: videoSeen,
    evidenceLevel: analysis.result.evidence_level,
    videoType: analysis.result.video_type,
    isRealReview: analysis.result.is_real_review,
  });

  // STAGE: FINAL DECISION (deterministic) — dùng ngưỡng admin cấu hình.
  const thresholds = await getThresholds();
  const cr = creative.result;
  const contentScore = computeContentScore(cr, thresholds);
  const groups = await getEnabledRiskGroups();
  const rs = policy.result.risk_scores;
  const policyCriticalBlock = groups.some(
    (g) => g.critical_blocks && g.category === "policy" && rs[g.key] === "critical",
  );
  const copyrightCriticalBlock = groups.some(
    (g) =>
      g.critical_blocks && g.category === "copyright" && rs[g.key] === "critical",
  );
  const decision = decideFinalAction(
    {
      evidence_level: analysis.result.evidence_level,
      video_type: analysis.result.video_type,
      is_real_review: analysis.result.is_real_review,
      review_depth_score: cr.review_depth_score,
      product_demo_score: cr.product_demo_score,
      authenticity_score: cr.authenticity_score,
      viral_hook_score: cr.viral_hook_score,
      retention_score: cr.retention_score,
      shareability_score: cr.shareability_score,
      sales_conversion_score: cr.sales_conversion_score,
      production_quality_score: cr.production_quality_score,
      policy_safety_score: policy.result.policy_safety_score,
      copyright_safety_score: policy.result.copyright_safety_score,
      final_policy_level: policy.result.final_policy_level,
      ip_trademark_risk: rs.ip_trademark_risk ?? "low",
      music_copyright_risk: rs.music_copyright_risk ?? "low",
      ugc_reupload_risk: rs.ugc_reupload_risk ?? "low",
      counterfeit_risk: rs.counterfeit_risk ?? "low",
      policy_critical_block: policyCriticalBlock,
      copyright_critical_block: copyrightCriticalBlock,
    },
    thresholds,
  );

  return {
    analysis: analysis.result,
    policy: policy.result,
    creative: { ...cr, creative_score: contentScore },
    decision,
  };
}
