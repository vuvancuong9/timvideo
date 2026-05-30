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
  confidence: AnalysisConfidence;
};

/** ----- Output schema của OpenAI policy check ----- */
export type PolicyCheckResult = {
  policy_safety_score: number;
  copyright_safety_score: number;
  misleading_claim_risk: RiskLevel;
  health_claim_risk: RiskLevel;
  personal_attribute_risk: RiskLevel;
  before_after_risk: RiskLevel;
  shocking_content_risk: RiskLevel;
  adult_sensitive_risk: RiskLevel;
  ip_trademark_risk: RiskLevel;
  restricted_product_risk: RiskLevel;
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
  ip_trademark_risk: RiskLevel;
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
