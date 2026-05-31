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
  computeCreativeScore,
  decideFinalAction,
} from "@/lib/video-review/final-decision";
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

  // STAGE: ANALYZE (Gemini) — KHÔNG bịa transcript/OCR (preview chưa extract).
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
    },
    imageParts,
  );

  // STAGE: POLICY (OpenAI)
  const policy = await checkPolicyWithOpenAI({
    productCategory: input.categoryName,
    shopeeProductUrl: input.shopeeProductUrl,
    visualSummary: analysis.result.visual_summary,
    transcript: null,
    ocrText: null,
    claimsDetected: analysis.result.claims_detected,
    metadataNote: input.hasVideoFile
      ? "Có file video upload Drive."
      : "Chỉ có link ngoài, không có file video.",
    hasVideoFile: input.hasVideoFile,
  });

  // STAGE: CREATIVE (OpenAI) — điểm tổng do code tự tính.
  const creative = await scoreCreativeWithOpenAI({
    productCategory: input.categoryName,
    shopeeProductUrl: input.shopeeProductUrl,
    productPrice: input.productPrice,
    commissionPercent: input.commissionPercent,
    summary: analysis.result.summary,
    hook3s: analysis.result.hook_3s,
    visualSummary: analysis.result.visual_summary,
    transcript: null,
    hasVideoFile: input.hasVideoFile,
  });
  const creativeScore = computeCreativeScore(creative.result);

  // STAGE: FINAL DECISION (deterministic)
  const decision = decideFinalAction({
    creative_score: creativeScore,
    policy_safety_score: policy.result.policy_safety_score,
    copyright_safety_score: policy.result.copyright_safety_score,
    final_policy_level: policy.result.final_policy_level,
    ip_trademark_risk: policy.result.ip_trademark_risk,
  });

  return {
    analysis: analysis.result,
    policy: policy.result,
    creative: { ...creative.result, creative_score: creativeScore },
    decision,
  };
}
