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
  computeCreativeScore,
  decideFinalAction,
} from "@/lib/video-review/final-decision";
import { getDriveFileInfo } from "@/lib/video-intake/drive";
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

  const hasVideoFile = Boolean(submission.drive_file_id);

  // STAGE 2: EXTRACT (MVP: chỉ metadata Drive, KHÔNG fake transcript/OCR)
  await setStage(db, job.id, "extract");
  const rawMetadata: Record<string, unknown> = {
    source_type: submission.source_type,
    has_video_file: hasVideoFile,
    extract_note:
      "MVP: chua cat frame/audio/transcript/OCR. Chi lay metadata file Drive neu co.",
  };
  let durationSeconds: number | null = null;
  if (hasVideoFile && submission.drive_file_id) {
    try {
      const info = await getDriveFileInfo(submission.drive_file_id);
      rawMetadata.drive = info;
    } catch (err) {
      rawMetadata.drive_error = String(err);
    }
  }
  // transcript/ocr = null (không bịa). frame_urls = [] (chưa extract).
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

  // STAGE 3: ANALYZE (Gemini)
  await setStage(db, job.id, "analyze");
  const analysis = await analyzeContentWithGemini({
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
    hasVideoFile,
  });
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
    raw_response:
      analysis.raw as Database["public"]["Tables"]["video_content_analysis"]["Insert"]["raw_response"],
  });
  await writeAuditLog({
    actorId: null,
    action: "review.analysis_completed",
    entityType: "video_submission",
    entityId: submission.id,
    after: { confidence: analysis.result.confidence },
  });

  // STAGE 4: POLICY CHECK (OpenAI)
  await setStage(db, job.id, "policy_check");
  const policy = await checkPolicyWithOpenAI({
    productCategory: categoryName,
    shopeeProductUrl: submission.shopee_product_url,
    visualSummary: analysis.result.visual_summary,
    transcript,
    ocrText,
    claimsDetected: analysis.result.claims_detected,
    metadataNote: hasVideoFile
      ? "Có file video upload Drive."
      : "Chỉ có link ngoài, không có file video.",
    hasVideoFile,
  });
  await db.from("facebook_policy_checks").insert({
    video_submission_id: submission.id,
    provider: "openai",
    model: policy.model,
    confidence: policy.result.confidence,
    policy_safety_score: policy.result.policy_safety_score,
    copyright_safety_score: policy.result.copyright_safety_score,
    misleading_claim_risk: policy.result.misleading_claim_risk,
    health_claim_risk: policy.result.health_claim_risk,
    personal_attribute_risk: policy.result.personal_attribute_risk,
    before_after_risk: policy.result.before_after_risk,
    shocking_content_risk: policy.result.shocking_content_risk,
    adult_sensitive_risk: policy.result.adult_sensitive_risk,
    ip_trademark_risk: policy.result.ip_trademark_risk,
    restricted_product_risk: policy.result.restricted_product_risk,
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
    hasVideoFile,
  });
  const creativeScore = computeCreativeScore(creative.result);
  await db.from("video_creative_scores").insert({
    video_submission_id: submission.id,
    provider: "openai",
    model: creative.model,
    confidence: creative.result.confidence,
    hook_score: creative.result.hook_score,
    product_clarity_score: creative.result.product_clarity_score,
    demo_score: creative.result.demo_score,
    trust_score: creative.result.trust_score,
    affiliate_fit_score: creative.result.affiliate_fit_score,
    remake_score: creative.result.remake_score,
    creative_score: creativeScore,
    reasons: creative.result.reasons,
    suggested_titles: creative.result.suggested_titles,
    suggested_scripts: creative.result.suggested_scripts,
    suggested_edits: creative.result.suggested_edits,
    raw_response:
      creative.raw as Database["public"]["Tables"]["video_creative_scores"]["Insert"]["raw_response"],
  });

  // STAGE 6: FINAL DECISION (deterministic — code quyết định)
  await setStage(db, job.id, "decision");
  const decision = decideFinalAction({
    creative_score: creativeScore,
    policy_safety_score: policy.result.policy_safety_score,
    copyright_safety_score: policy.result.copyright_safety_score,
    final_policy_level: policy.result.final_policy_level,
    ip_trademark_risk: policy.result.ip_trademark_risk,
  });
  await db.from("video_final_decisions").insert({
    video_submission_id: submission.id,
    creative_score: decision.creative_score,
    policy_safety_score: decision.policy_safety_score,
    copyright_safety_score: decision.copyright_safety_score,
    final_score: decision.final_score,
    final_action: decision.final_action,
    decision_reason: decision.decision_reason,
    blocking_reasons: decision.blocking_reasons,
    required_edits: decision.required_edits,
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
  };
  await db
    .from("video_submissions")
    .update({ status: statusMap[decision.final_action] ?? "reviewed" })
    .eq("id", submission.id);

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
      const { finalAction } = await processClaimedJob(db, job);
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
