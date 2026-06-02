import type { Database, Tables } from "@/lib/database.types";

export type RiskLevel = Database["public"]["Enums"]["risk_level"];
export type AnalysisConfidence =
  Database["public"]["Enums"]["analysis_confidence"];
export type VideoFinalAction =
  Database["public"]["Enums"]["video_final_action"];
export type VideoReviewJobStatus =
  Database["public"]["Enums"]["video_review_job_status"];
export type VideoReviewStage =
  Database["public"]["Enums"]["video_review_stage"];

export type VideoReviewJobRow = Tables<"video_review_jobs">;
export type VideoExtractedAssetsRow = Tables<"video_extracted_assets">;
export type VideoContentAnalysisRow = Tables<"video_content_analysis">;
export type FacebookPolicyCheckRow = Tables<"facebook_policy_checks">;
export type VideoCreativeScoreRow = Tables<"video_creative_scores">;
export type VideoFinalDecisionRow = Tables<"video_final_decisions">;

export const RISK_LEVELS: RiskLevel[] = ["low", "medium", "high", "critical"];
export const CONFIDENCES: AnalysisConfidence[] = ["low", "medium", "high"];

/**
 * Mức bằng chứng thực tế dùng để chấm. CODE quyết định (dựa trên part đã gửi
 * Gemini), KHÔNG tin model tự khai. video > frames > images_only > text_only.
 */
export type EvidenceLevel = "video" | "frames" | "images_only" | "text_only";

/** Loại video do AI phân loại (review thật vs sales_deal...). */
export type ReviewVideoType =
  | "review"
  | "sales_deal"
  | "unboxing"
  | "demo"
  | "comparison"
  | "testimonial"
  | "unknown";

/** 1 bằng chứng quan sát được theo mốc thời gian (chỉ khi xem được video). */
export type ObservedEvidence = {
  timestamp: string;
  evidence: string;
  affects: string[];
};

/** Chẩn đoán "chuyên gia": vì sao video chưa đạt review/viral. */
export type ExpertDiagnosis = {
  main_problem: string;
  why_not_review: string[];
  why_not_viral_enough: string[];
  recommended_fix: string[];
};

/** ----- Output schema của Gemini content analysis ----- */
export type ContentAnalysisResult = {
  summary: string;
  hook_3s: string;
  visual_summary: string;
  product_detected: string;
  claims_detected: string[];
  pain_points: string[];
  audience_profile: Record<string, unknown>;
  key_moments: string[];
  strong_scenes: string[];
  weak_scenes: string[];
  remake_angles: string[];
  /** Gemini có thực sự "thấy" video không (đối chiếu với part code đã gửi). */
  video_seen: boolean;
  /** Mức bằng chứng đã được code chốt (sau khi đối chiếu model). */
  evidence_level: EvidenceLevel;
  /** Dấu hiệu rủi ro chính sách nhìn thấy trực tiếp trong video/ảnh. */
  policy_visible_evidence: string[];
  confidence: AnalysisConfidence;

  /** Mục tiêu chấm = review/chia sẻ/lan tỏa (cố định). */
  objective: "review_share_viral";
  /** Loại video AI phân loại. */
  video_type: ReviewVideoType;
  /** Có phải review thật không (không phải chỉ cầm SP + hiện giá). */
  is_real_review: boolean;
  /** Bằng chứng quan sát theo timestamp. */
  observed_evidence: ObservedEvidence[];
  /** Chẩn đoán vì sao chưa đạt review/viral + cách sửa. */
  expert_diagnosis: ExpertDiagnosis;
};

/** ----- Output schema của OpenAI policy check ----- */
export type PolicyCheckResult = {
  policy_safety_score: number;
  copyright_safety_score: number;
  /** Mức rủi ro theo từng nhóm cấu hình động: { group_key -> RiskLevel }. */
  risk_scores: Record<string, RiskLevel>;
  risk_reasons: string[];
  policy_references: string[];
  suggested_fixes: string[];
  final_policy_level: RiskLevel;
  confidence: AnalysisConfidence;
};

/** ----- Output schema của OpenAI review/viral score (model phần) ----- */
export type CreativeScoreModelResult = {
  review_depth_score: number;
  product_demo_score: number;
  authenticity_score: number;
  viral_hook_score: number;
  retention_score: number;
  shareability_score: number;
  sales_conversion_score: number;
  production_quality_score: number;
  reasons: string[];
  suggested_titles: string[];
  suggested_scripts: string[];
  suggested_edits: string[];
  confidence: AnalysisConfidence;
};

/** Đầu vào tổng hợp cho final-decision (deterministic, review/viral). */
export type FinalDecisionInput = {
  /** Bằng chứng thực tế — text_only/images_only ⇒ KHÔNG tự APPROVE. */
  evidence_level: EvidenceLevel;
  video_type: ReviewVideoType;
  is_real_review: boolean;

  review_depth_score: number;
  product_demo_score: number;
  authenticity_score: number;
  viral_hook_score: number;
  retention_score: number;
  shareability_score: number;
  sales_conversion_score: number;
  production_quality_score: number;

  policy_safety_score: number;
  copyright_safety_score: number;
  final_policy_level: RiskLevel;
  ip_trademark_risk: RiskLevel;
  music_copyright_risk?: RiskLevel;
  ugc_reupload_risk?: RiskLevel;
  counterfeit_risk?: RiskLevel;

  /** Suy từ nhóm rủi ro động (critical_blocks) — chặn thêm nếu admin thêm nhóm. */
  policy_critical_block?: boolean;
  copyright_critical_block?: boolean;
};

export type FinalDecisionResult = {
  /** = content_score (giữ tên cũ cho UI/cột DB legacy). */
  creative_score: number;
  content_score: number;
  review_depth_score: number;
  policy_safety_score: number;
  copyright_safety_score: number;
  final_score: number;
  final_action: VideoFinalAction;
  decision_reason: string;
  blocking_reasons: string[];
  required_edits: string[];
};
