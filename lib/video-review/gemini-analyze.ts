/**
 * Gemini content analysis (STAGE 3). Server-only.
 * Gọi Gemini REST API (generateContent) — không thêm SDK. Trả strict JSON.
 */
import { getGeminiConfig } from "@/lib/secrets";
import {
  CONTENT_ANALYSIS_SYSTEM_PROMPT,
  buildContentAnalysisUserPrompt,
  type ContentAnalysisPromptInput,
} from "@/lib/video-review/prompts/content-analysis";
import {
  capConfidenceWhenNoFile,
  coerceConfidence,
  coerceStringArray,
  extractJson,
  withRetry,
} from "@/lib/video-review/ai-util";
import type { ContentAnalysisResult } from "@/types/videoReview";

export type GeminiAnalyzeOutput = {
  result: ContentAnalysisResult;
  model: string;
  raw: unknown;
};

export async function analyzeContentWithGemini(
  input: ContentAnalysisPromptInput,
): Promise<GeminiAnalyzeOutput> {
  const { apiKey, model } = await getGeminiConfig();
  if (!apiKey) {
    throw new Error("Thiếu GEMINI_API_KEY để phân tích nội dung video");
  }

  const userPrompt = buildContentAnalysisUserPrompt(input);
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model,
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const body = {
    systemInstruction: {
      role: "system",
      parts: [{ text: CONTENT_ANALYSIS_SYSTEM_PROMPT }],
    },
    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    generationConfig: {
      temperature: 0.4,
      responseMimeType: "application/json",
    },
  };

  const raw = await withRetry(
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

  const text: string =
    raw?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  const parsed = extractJson<Record<string, unknown>>(text);

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
    confidence: capConfidenceWhenNoFile(
      coerceConfidence(parsed.confidence),
      input.hasVideoFile,
    ),
  };

  return { result, model, raw };
}
