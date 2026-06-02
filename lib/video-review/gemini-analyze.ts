/**
 * Gemini content analysis (STAGE 3). Server-only.
 * Gọi Gemini REST API (generateContent) — không thêm SDK. Trả strict JSON.
 *
 * Nhận VIDEO THẬT (videoPart: inline_data hoặc file_data) — không chỉ text/ảnh.
 * evidence_level do CODE chốt (dựa videoPart đã gửi + đối chiếu model.video_seen),
 * model KHÔNG thể tự nâng. Nếu Gemini lỗi vì không đọc được file video → ném rõ,
 * TUYỆT ĐỐI không fallback bịa nội dung.
 */
import { getGeminiConfig } from "@/lib/secrets";
import {
  CONTENT_ANALYSIS_SYSTEM_PROMPT,
  buildContentAnalysisUserPrompt,
  type ContentAnalysisPromptInput,
} from "@/lib/video-review/prompts/content-analysis";
import {
  coerceConfidence,
  coerceStringArray,
  extractJson,
  withRetry,
} from "@/lib/video-review/ai-util";
import {
  capConfidence,
  getConfidenceRule,
} from "@/lib/video-review/confidence-config";
import {
  coerceEvidenceLevel,
  reconcileEvidence,
  type VideoPart,
} from "@/lib/video-review/gemini-video-input";
import type {
  ContentAnalysisResult,
  EvidenceLevel,
  ReviewVideoType,
  ObservedEvidence,
  ExpertDiagnosis,
} from "@/types/videoReview";

export type GeminiAnalyzeOutput = {
  result: ContentAnalysisResult;
  model: string;
  raw: unknown;
};

export type GeminiImagePart = { data: string; mimeType: string };

export type AnalyzeOpts = {
  videoPart?: VideoPart | null;
  imageParts?: GeminiImagePart[];
  modelOverride?: string;
};

type GeminiPart =
  | { text: string }
  | { inline_data: { mime_type: string; data: string } }
  | { file_data: { file_uri: string; mime_type?: string } };

/** Lỗi từ Gemini có phải do không truy cập được file/uri video không. */
function isFileAccessError(msg: string): boolean {
  return /file|file_uri|\buri\b|FAILED_PRECONDITION|not .*ACTIVE|PERMISSION_DENIED|unsupported/i.test(
    msg,
  );
}

function coerceBool(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  const s = String(v ?? "").toLowerCase();
  return s === "true" || s === "1" || s === "yes";
}

const VIDEO_TYPES: ReviewVideoType[] = [
  "review",
  "sales_deal",
  "unboxing",
  "demo",
  "comparison",
  "testimonial",
  "unknown",
];
function coerceVideoType(v: unknown): ReviewVideoType {
  const s = String(v ?? "").toLowerCase();
  return (VIDEO_TYPES as string[]).includes(s)
    ? (s as ReviewVideoType)
    : "unknown";
}

function coerceObservedEvidence(v: unknown): ObservedEvidence[] {
  if (!Array.isArray(v)) return [];
  return v.slice(0, 30).map((x) => {
    const o = x && typeof x === "object" ? (x as Record<string, unknown>) : {};
    return {
      timestamp: String(o.timestamp ?? ""),
      evidence: String(o.evidence ?? ""),
      affects: coerceStringArray(o.affects),
    };
  });
}

function coerceExpertDiagnosis(v: unknown): ExpertDiagnosis {
  const o = v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  return {
    main_problem: String(o.main_problem ?? ""),
    why_not_review: coerceStringArray(o.why_not_review),
    why_not_viral_enough: coerceStringArray(o.why_not_viral_enough),
    recommended_fix: coerceStringArray(o.recommended_fix),
  };
}

export async function analyzeContentWithGemini(
  input: ContentAnalysisPromptInput,
  opts?: AnalyzeOpts,
): Promise<GeminiAnalyzeOutput> {
  const cfg = await getGeminiConfig();
  const apiKey = cfg.apiKey;
  if (!apiKey) {
    throw new Error("Thiếu GEMINI_API_KEY để phân tích nội dung video");
  }
  const model = opts?.modelOverride || cfg.model;

  const rule = await getConfidenceRule();
  const userPrompt = buildContentAnalysisUserPrompt(input);
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model,
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const videoPart = opts?.videoPart ?? null;
  const imageParts = opts?.imageParts ?? [];

  // Thứ tự: VIDEO trước → prompt → ảnh (số liệu tương tác).
  const parts: GeminiPart[] = [];
  if (videoPart) parts.push(videoPart as GeminiPart);
  parts.push({ text: userPrompt });
  for (const img of imageParts) {
    parts.push({ inline_data: { mime_type: img.mimeType, data: img.data } });
  }

  const body = {
    systemInstruction: {
      role: "system",
      parts: [{ text: CONTENT_ANALYSIS_SYSTEM_PROMPT }],
    },
    contents: [{ role: "user", parts }],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: "application/json",
    },
  };

  let raw: {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  try {
    raw = await withRetry(
      async () => {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const t = await res.text().catch(() => "");
          throw new Error(`Gemini error ${res.status}: ${t}`.slice(0, 500));
        }
        return res.json();
      },
      { retries: 3, label: "gemini-analyze" },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (videoPart && isFileAccessError(msg)) {
      throw new Error(
        `Gemini không đọc được file video đã gửi — không chấm dựa trên nội dung bịa. (${msg.slice(0, 180)})`,
      );
    }
    throw e;
  }

  const text: string = raw?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  const parsed = extractJson<Record<string, unknown>>(text);

  // evidence_level CODE-authoritative: model không thể tự nâng quá những gì code gửi.
  const modelVideoSeen = parsed.video_seen === true;
  const codeMax: EvidenceLevel =
    videoPart && modelVideoSeen
      ? "video"
      : imageParts.length > 0
        ? "images_only"
        : "text_only";
  const evidence_level = reconcileEvidence(
    codeMax,
    coerceEvidenceLevel(parsed.evidence_level),
  );
  const video_seen = Boolean(videoPart) && modelVideoSeen;

  const result: ContentAnalysisResult = {
    summary: String(parsed.summary ?? ""),
    hook_3s: String(parsed.hook_3s ?? ""),
    visual_summary: String(parsed.visual_summary ?? ""),
    product_detected: String(parsed.product_detected ?? ""),
    claims_detected: coerceStringArray(parsed.claims_detected),
    pain_points: coerceStringArray(parsed.pain_points),
    audience_profile:
      parsed.audience_profile && typeof parsed.audience_profile === "object"
        ? (parsed.audience_profile as Record<string, unknown>)
        : {},
    key_moments: coerceStringArray(parsed.key_moments),
    strong_scenes: coerceStringArray(parsed.strong_scenes),
    weak_scenes: coerceStringArray(parsed.weak_scenes),
    remake_angles: coerceStringArray(parsed.remake_angles),
    video_seen,
    evidence_level,
    policy_visible_evidence: coerceStringArray(parsed.policy_visible_evidence),
    // Cap confidence theo VIDEO THẬT đã thấy (không phải chỉ "có file").
    confidence: capConfidence(
      coerceConfidence(parsed.confidence),
      evidence_level === "video",
      rule,
    ),

    objective: "review_share_viral",
    video_type: coerceVideoType(parsed.video_type),
    // Anti-bias: KHÔNG coi là review thật nếu chưa xem được video thật.
    is_real_review: coerceBool(parsed.is_real_review) && evidence_level === "video",
    observed_evidence: coerceObservedEvidence(parsed.observed_evidence),
    expert_diagnosis: coerceExpertDiagnosis(parsed.expert_diagnosis),
  };

  return { result, model, raw };
}
