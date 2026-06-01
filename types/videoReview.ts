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

/** ----- Output schema của OpenAI creative score (model phần) ----- */
export type CreativeScoreModelResult = {
  hook_score: number;
  product_clarity_score: number;
  demo_score: number;
  trust_score: number;
  affiliate_fit_score: number;
  remake_score: number;
  reasons: string[];
  suggested_titles: string[];
  suggested_scripts: string[];
  suggested_edits: string[];
  confidence: AnalysisConfidence;
};

/** Đầu vào tổng hợp cho final-decision (deterministic). */
export type FinalDecisionInput = {
  creative_score: number;
  policy_safety_score: number;
  copyright_safety_score: number;
  final_policy_level: RiskLevel;
  /**
   * @deprecated Alias tương thích — giữ cho test/cũ. Production truyền
   * copyright_critical_block (suy từ các nhóm rủi ro cấu hình động).
   */
  ip_trademark_risk?: RiskLevel;
  /** Có nhóm category="policy" + critical_blocks bị chấm "critical" → reject policy. */
  policy_critical_block?: boolean;
  /** Có nhóm category="copyright" + critical_blocks bị chấm "critical" → reject copyright. */
  copyright_critical_block?: boolean;
  /**
   * Mức bằng chứng thực tế. Nếu text_only/images_only → KHÔNG được tự
   * APPROVE_RUN_ADS. undefined ⇒ bỏ qua gate (giữ hành vi/test cũ).
   */
  evidence_level?: EvidenceLevel;
};

export type FinalDecisionResult = {
  creative_score: number;
  policy_safety_score: number;
  copyright_safety_score: number;
  final_score: number;
  final_action: VideoFinalAction;
  decision_reason: string;
  blocking_reasons: string[];
  required_edits: string[];
};
