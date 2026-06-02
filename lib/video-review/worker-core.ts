/**
 * Worker pipeline cho video review. Server-only, chạy bằng service role.
 *
 * Stages: CLAIMED → INGEST → EXTRACT → ANALYZE → POLICY → SCORE → DECISION → DONE
 * - Soft deadline cho Vercel cron (mặc định 55s).
 * - Stale recovery + max attempts do RPC claim_video_review_job lo.
 * - Idempotent: mỗi lần chạy insert row analysis/policy/score MỚI; dashboard
 *   luôn lấy bản latest theo created_at desc.
 *
 * GIỚI HẠN MVP (xem báo cáo): EXTRACT chưa cắt frame/tách audio/transcript/OCR
 * thực sự — chỉ lấy metadata file Drive. Vì vậy khi KHÔNG có file video,
 * confidence luôn bị giới hạn ở mức ≤ medium.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { writeAuditLog } from "@/lib/audit";
import { analyzeContentWithGemini } from "@/lib/video-review/gemini-analyze";
import { checkPolicyWithOpenAI } from "@/lib/video-review/openai-policy";
import { scoreCreativeWithOpenAI } from "@/lib/video-review/openai-creative-score";
import {
  computeContentScore,
  decideFinalAction,
} from "@/lib/video-review/final-decision";
import { getThresholds } from "@/lib/video-review/policy-config";
import { getEnabledRiskGroups } from "@/lib/video-review/policy-groups-config";
import { getGeminiConfig, getGeminiReviewConfig } from "@/lib/secrets";
import { resolveVideoInput } from "@/lib/video-review/gemini-video-input";
import { getDriveFileInfo } from "@/lib/video-intake/drive";
import {
  loadImagePartsFromAttachments,
  parseAttachments,
} from "@/lib/video-review/images";
import { updateSubmissionScores } from "@/lib/sheets";
import {
  FINAL_ACTION_LABELS,
  FINAL_ACTION_VERDICT,
} from "@/lib/video-intake/labels";
import type { Database } from "@/lib/database.types";
import type { VideoReviewStage } from "@/types/videoReview";

type Db = SupabaseClient<Database>;
type JobRow = Database["public"]["Tables"]["video_review_jobs"]["Row"];
type SubmissionRow = Database["public"]["Tables"]["video_submissions"]["Row"];

const DEFAULT_DEADLINE_MS = 55_000;

export type WorkerRunResult = {
  processed: number;
  results: Array<{
    jobId: string;
    submissionId: string;
    ok: boolean;
    finalAction?: string;
    error?: string;
  }>;
};

async function setStage(
  db: Db,
  jobId: string,
  stage: VideoReviewStage,
): Promise<void> {
  await db.from("video_review_jobs").update({ stage }).eq("id", jobId);
}

async function getCategoryName(
  db: Db,
  categoryId: string | null,
): Promise<string | null> {
  if (!categoryId) return null;
  const { data } = await db
    .from("product_categories")
    .select("name")
    .eq("id", categoryId)
    .maybeSingle();
  return data?.name ?? null;
}

/** Xử lý 1 job đã claim. Ném lỗi nếu fail (caller cập nhật job.failed). */
async function processClaimedJob(
  db: Db,
  job: JobRow,
  deadlineAt: number,
): Promise<{ finalAction: string }> {
  // STAGE 1: INGEST
  await setStage(db, job.id, "ingest");
  const { data: sub, error: subErr } = await db
    .from("video_submissions")
    .select("*")
    .eq("id", job.video_submission_id)
    .single();
  if (subErr || !sub) {
    throw new Error("Không tải được submission cho job");
  }
  const submission = sub as SubmissionRow;
  await db
    .from("video_submissions")
    .update({ status: "processing" })
    .eq("id", submission.id);

  // Có file video nếu có drive_file_id (Drive cũ) hoặc drive_web_url (Storage mới).
  const hasVideoFile = Boolean(
    submission.drive_file_id || submission.drive_web_url,
  );

  // STAGE 2: EXTRACT — chuẩn bị VIDEO THẬT cho Gemini (inline/Files API/YouTube).
  await setStage(db, job.id, "extract");
  // Ảnh đính kèm (vd ảnh chụp like/view/comment) -> đưa vào Gemini.
  const attachments = parseAttachments(submission.attachments);
  const imageParts = await loadImagePartsFromAttachments(attachments);
  const { apiKey: geminiKey } = await getGeminiConfig();
  const video = await resolveVideoInput({
    sourceType: submission.source_type,
    originalVideoUrl: submission.original_video_url,
    driveWebUrl: submission.drive_web_url,
    attachments,
    apiKey: geminiKey ?? "",
    deadlineAt,
    allowFilesApi: true,
    inlineDisallowed: imageParts.length > 0,
  });
  const rawMetadata: Record<string, unknown> = {
    source_type: submission.source_type,
    has_video_file: hasVideoFile,
    video_source: video.source,
    video_sent: video.videoSeenSent,
    extract_note: video.videoSeenSent
      ? "Video gui thang vao Gemini de phan tich (khong cat frame)."
      : "Khong gui duoc video that vao Gemini — cham so bo.",
  };
  if (video.warning) rawMetadata.video_warning = video.warning;
  const durationSeconds: number | null = null;
  if (hasVideoFile && submission.drive_file_id) {
    try {
      const info = await getDriveFileInfo(submission.drive_file_id);
      rawMetadata.drive = info;
    } catch (err) {
      rawMetadata.drive_error = String(err);
    }
  }
  // transcript/ocr = null (không bịa). frame_urls = [] (chưa cắt frame).
  await db.from("video_extracted_assets").insert({
    video_submission_id: submission.id,
    transcript_text: null,
    ocr_text: null,
    frame_urls: [],
    duration_seconds: durationSeconds,
    raw_metadata: rawMetadata as Database["public"]["Tables"]["video_extracted_assets"]["Insert"]["raw_metadata"],
  });

  const categoryName = await getCategoryName(db, submission.category_id);
  const transcript: string | null = null;
  const ocrText: string | null = null;

  // STAGE 3: ANALYZE (Gemini) — gửi VIDEO THẬT nếu có.
  await setStage(db, job.id, "analyze");
  const analyzeInput = {
    productCategory: categoryName,
    shopeeProductUrl: submission.shopee_product_url,
    productPrice: Number(submission.product_price),
    commissionPercent: Number(submission.commission_percent),
    sourceType: submission.source_type,
    videoUrl: submission.original_video_url,
    driveWebUrl: submission.drive_web_url,
    transcript,
    ocrText,
    frameCount: 0,
    imageCount: imageParts.length,
    hasVideoFile,
    videoProvided: video.videoSeenSent,
    evidenceLevel: (video.videoSeenSent
      ? "video"
      : imageParts.length > 0
        ? "images_only"
        : "text_only") as "video" | "frames" | "images_only" | "text_only",
    videoSeen: video.videoSeenSent,
    videoInputWarnings: video.warning ? [video.warning] : [],
  };
  let analysis = await analyzeContentWithGemini(analyzeInput, {
    videoPart: video.part,
    imageParts,
  });

  // SECOND-PASS (tùy chọn admin): chấm lại bằng model mạnh hơn cho video
  // rủi ro / độ tin chưa cao. Reuse cùng video part (không upload lại).
  const reviewCfg = await getGeminiReviewConfig();
  const wantReview =
    reviewCfg.mode !== "off" &&
    analysis.result.evidence_level === "video" &&
    (reviewCfg.mode === "always" || analysis.result.confidence !== "high") &&
    Date.now() < deadlineAt - 25_000;
  if (wantReview) {
    try {
      analysis = await analyzeContentWithGemini(analyzeInput, {
        videoPart: video.part,
        imageParts,
        modelOverride: reviewCfg.model,
      });
    } catch {
      // second-pass lỗi → giữ kết quả first-pass (đã có).
    }
  }

  await db.from("video_content_analysis").insert({
    video_submission_id: submission.id,
    provider: "gemini",
    model: analysis.model,
    confidence: analysis.result.confidence,
    summary: analysis.result.summary,
    hook_3s: analysis.result.hook_3s,
    visual_summary: analysis.result.visual_summary,
    product_detected: analysis.result.product_detected,
    claims_detected: analysis.result.claims_detected,
    pain_points: analysis.result.pain_points,
    audience_profile:
      analysis.result.audience_profile as Database["public"]["Tables"]["video_content_analysis"]["Insert"]["audience_profile"],
    key_moments: analysis.result.key_moments,
    strong_scenes: analysis.result.strong_scenes,
    weak_scenes: analysis.result.weak_scenes,
    remake_angles: analysis.result.remake_angles,
    objective: analysis.result.objective,
    evidence_level: analysis.result.evidence_level,
    video_type: analysis.result.video_type,
    is_real_review: analysis.result.is_real_review,
    video_seen: analysis.result.video_seen,
    observed_evidence:
      analysis.result.observed_evidence as Database["public"]["Tables"]["video_content_analysis"]["Insert"]["observed_evidence"],
    expert_diagnosis:
      analysis.result.expert_diagnosis as Database["public"]["Tables"]["video_content_analysis"]["Insert"]["expert_diagnosis"],
    raw_response: {
      policy_visible_evidence: analysis.result.policy_visible_evidence,
      gemini: analysis.raw,
    } as Database["public"]["Tables"]["video_content_analysis"]["Insert"]["raw_response"],
  });
  await writeAuditLog({
    actorId: null,
    action: "review.analysis_completed",
    entityType: "video_submission",
    entityId: submission.id,
    after: {
      confidence: analysis.result.confidence,
      evidence_level: analysis.result.evidence_level,
    },
  });

  // STAGE 4: POLICY CHECK (OpenAI) — cap confidence theo VIDEO THẬT đã xem.
  await setStage(db, job.id, "policy_check");
  const videoSeen = analysis.result.evidence_level === "video";
  const policy = await checkPolicyWithOpenAI({
    productCategory: categoryName,
    shopeeProductUrl: submission.shopee_product_url,
    visualSummary: analysis.result.visual_summary,
    transcript,
    ocrText,
    claimsDetected: analysis.result.claims_detected,
    metadataNote: videoSeen
      ? "Đã phân tích video thật."
      : "Chưa có video thật (chỉ link/ảnh) — đánh giá sơ bộ.",
    hasVideoFile: videoSeen,
  });
  const rs = policy.result.risk_scores;
  await db.from("facebook_policy_checks").insert({
    video_submission_id: submission.id,
    provider: "openai",
    model: policy.model,
    confidence: policy.result.confidence,
    policy_safety_score: policy.result.policy_safety_score,
    copyright_safety_score: policy.result.copyright_safety_score,
    risk_scores:
      rs as Database["public"]["Tables"]["facebook_policy_checks"]["Insert"]["risk_scores"],
    // Dual-write 8 cột legacy (back-compat reader cũ); khóa thiếu -> 'low'.
    misleading_claim_risk: rs.misleading_claim_risk ?? "low",
    health_claim_risk: rs.health_claim_risk ?? "low",
    personal_attribute_risk: rs.personal_attribute_risk ?? "low",
    before_after_risk: rs.before_after_risk ?? "low",
    shocking_content_risk: rs.shocking_content_risk ?? "low",
    adult_sensitive_risk: rs.adult_sensitive_risk ?? "low",
    ip_trademark_risk: rs.ip_trademark_risk ?? "low",
    restricted_product_risk: rs.restricted_product_risk ?? "low",
    misleading_price_risk: rs.misleading_price_risk ?? "low",
    brand_visible_warning: rs.brand_visible_warning ?? "low",
    counterfeit_risk: rs.counterfeit_risk ?? "low",
    music_copyright_risk: rs.music_copyright_risk ?? "low",
    ugc_reupload_risk: rs.ugc_reupload_risk ?? "low",
    risk_reasons: policy.result.risk_reasons,
    policy_references: policy.result.policy_references,
    suggested_fixes: policy.result.suggested_fixes,
    final_policy_level: policy.result.final_policy_level,
    raw_response:
      policy.raw as Database["public"]["Tables"]["facebook_policy_checks"]["Insert"]["raw_response"],
  });
  await writeAuditLog({
    actorId: null,
    action: "review.policy_completed",
    entityType: "video_submission",
    entityId: submission.id,
    after: {
      policy_safety_score: policy.result.policy_safety_score,
      final_policy_level: policy.result.final_policy_level,
    },
  });

  // STAGE 5: CREATIVE SCORE (OpenAI) — creative_score tổng do code tính
  await setStage(db, job.id, "score");
  const creative = await scoreCreativeWithOpenAI({
    productCategory: categoryName,
    shopeeProductUrl: submission.shopee_product_url,
    productPrice: Number(submission.product_price),
    commissionPercent: Number(submission.commission_percent),
    summary: analysis.result.summary,
    hook3s: analysis.result.hook_3s,
    visualSummary: analysis.result.visual_summary,
    transcript,
    hasVideoFile: videoSeen,
    evidenceLevel: analysis.result.evidence_level,
    videoType: analysis.result.video_type,
    isRealReview: analysis.result.is_real_review,
  });
  const thresholds = await getThresholds();
  const cr = creative.result;
  const contentScore = computeContentScore(cr, thresholds);
  await db.from("video_creative_scores").insert({
    video_submission_id: submission.id,
    provider: "openai",
    model: creative.model,
    confidence: cr.confidence,
    // Map điểm review/viral -> cột legacy để UI cũ không vỡ.
    hook_score: cr.viral_hook_score,
    product_clarity_score: cr.production_quality_score,
    demo_score: cr.product_demo_score,
    trust_score: cr.authenticity_score,
    affiliate_fit_score: cr.sales_conversion_score,
    remake_score: cr.shareability_score,
    creative_score: contentScore,
    // Cột review/viral mới.
    review_depth_score: cr.review_depth_score,
    product_demo_score: cr.product_demo_score,
    authenticity_score: cr.authenticity_score,
    viral_hook_score: cr.viral_hook_score,
    retention_score: cr.retention_score,
    shareability_score: cr.shareability_score,
    sales_conversion_score: cr.sales_conversion_score,
    production_quality_score: cr.production_quality_score,
    content_score: contentScore,
    reasons: cr.reasons,
    suggested_titles: cr.suggested_titles,
    suggested_scripts: cr.suggested_scripts,
    suggested_edits: cr.suggested_edits,
    raw_response:
      creative.raw as Database["public"]["Tables"]["video_creative_scores"]["Insert"]["raw_response"],
  });

  // STAGE 6: FINAL DECISION (deterministic — code quyết định)
  await setStage(db, job.id, "decision");
  // Suy điều kiện reject-critical từ nhóm rủi ro cấu hình động.
  const decisionGroups = await getEnabledRiskGroups();
  const policyCriticalBlock = decisionGroups.some(
    (g) => g.critical_blocks && g.category === "policy" && rs[g.key] === "critical",
  );
  const copyrightCriticalBlock = decisionGroups.some(
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
  await db.from("video_final_decisions").insert({
    video_submission_id: submission.id,
    creative_score: decision.creative_score,
    content_score: decision.content_score,
    review_depth_score: decision.review_depth_score,
    policy_safety_score: decision.policy_safety_score,
    copyright_safety_score: decision.copyright_safety_score,
    final_score: decision.final_score,
    final_action: decision.final_action,
    decision_reason: decision.decision_reason,
    blocking_reasons: decision.blocking_reasons,
    required_edits: decision.required_edits,
    evidence_level: analysis.result.evidence_level,
    video_type: analysis.result.video_type,
    is_real_review: analysis.result.is_real_review,
  });

  // map final_action → submission.status
  const statusMap: Record<
    string,
    Database["public"]["Enums"]["video_submission_status"]
  > = {
    APPROVE_RUN_ADS: "approved",
    NEED_EDIT: "need_edit",
    REMAKE_SAFE: "reviewed",
    REJECT_POLICY_RISK: "rejected",
    REJECT_COPYRIGHT_RISK: "rejected",
    LOW_PERFORMANCE: "reviewed",
    REMAKE_AS_REVIEW: "need_edit",
    LOW_REVIEW_QUALITY: "reviewed",
    NEED_RIGHTS_CHECK: "need_edit",
  };
  await db
    .from("video_submissions")
    .update({ status: statusMap[decision.final_action] ?? "reviewed" })
    .eq("id", submission.id);

  // Cập nhật điểm + kết luận vào Google Sheet (best-effort theo Sub ID).
  if (submission.sub_id) {
    try {
      await updateSubmissionScores(submission.sub_id, {
        status: FINAL_ACTION_LABELS[decision.final_action],
        creative: decision.creative_score,
        policy: decision.policy_safety_score,
        copyright: decision.copyright_safety_score,
        finalScore: decision.final_score,
        verdict: FINAL_ACTION_VERDICT[decision.final_action].headline,
      });
    } catch {
      // không làm fail job vì lỗi Sheet
    }
  }

  await writeAuditLog({
    actorId: null,
    action: "review.final_decision",
    entityType: "video_submission",
    entityId: submission.id,
    after: {
      final_action: decision.final_action,
      final_score: decision.final_score,
    },
  });

  // STAGE DONE
  await db
    .from("video_review_jobs")
    .update({
      status: "done",
      stage: "done",
      progress_done: 6,
      progress_total: 6,
      finished_at: new Date().toISOString(),
      error: null,
    })
    .eq("id", job.id);

  try {
    await db.rpc("refresh_video_review_summary");
  } catch {
    // summary là phụ, lỗi không làm fail job
  }

  return { finalAction: decision.final_action };
}

/**
 * Chạy worker 1 vòng: claim & xử lý lần lượt cho tới khi hết job hoặc gần deadline.
 */
export async function runVideoReviewWorkerOnce(opts?: {
  workerName?: string;
  deadlineMs?: number;
  maxJobs?: number;
}): Promise<WorkerRunResult> {
  const db = createSupabaseAdminClient();
  const workerName = opts?.workerName ?? "worker";
  const deadlineMs = opts?.deadlineMs ?? DEFAULT_DEADLINE_MS;
  const maxJobs = opts?.maxJobs ?? 20;
  const startedAt = Date.now();

  const results: WorkerRunResult["results"] = [];

  while (results.length < maxJobs && Date.now() - startedAt < deadlineMs) {
    const { data: claimed, error: claimErr } = await db.rpc(
      "claim_video_review_job",
      { worker_name: workerName },
    );
    if (claimErr) throw claimErr;
    // RPC trả về null (không còn job) → kết thúc vòng
    if (!claimed) break;
    const job = claimed as unknown as JobRow;

    try {
      const { finalAction } = await processClaimedJob(db, job, startedAt + deadlineMs);
      results.push({
        jobId: job.id,
        submissionId: job.video_submission_id,
        ok: true,
        finalAction,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // Nếu đã đạt max attempts thì đánh failed hẳn, nếu chưa thì để queued lại
      // cho lần sau retry (giữ status running + locked sẽ được stale-reclaim sau 30').
      const isFinalAttempt = job.attempt_count >= 3;
      await db
        .from("video_review_jobs")
        .update({
          status: isFinalAttempt ? "failed" : "queued",
          stage: "failed",
          error: message.slice(0, 1000),
          locked_by: null,
          locked_at: null,
          finished_at: isFinalAttempt ? new Date().toISOString() : null,
        })
        .eq("id", job.id);
      results.push({
        jobId: job.id,
        submissionId: job.video_submission_id,
        ok: false,
        error: message,
      });
    }
  }

  return { processed: results.length, results };
}
