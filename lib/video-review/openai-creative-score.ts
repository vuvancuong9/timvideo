/**
 * OpenAI creative scoring (STAGE 5). Server-only.
 * Model chấm 6 tiêu chí; creative_score tổng do CODE tự tính (final-decision).
 */
import { getOpenAIConfig } from "@/lib/secrets";
import {
  CREATIVE_SCORE_SYSTEM_PROMPT,
  buildCreativeScoreUserPrompt,
  type CreativePromptInput,
} from "@/lib/video-review/prompts/creative-score";
import {
  coerceConfidence,
  coerceScore,
  coerceStringArray,
  extractJson,
  withRetry,
} from "@/lib/video-review/ai-util";
import {
  capConfidence,
  getConfidenceRule,
} from "@/lib/video-review/confidence-config";
import type { CreativeScoreModelResult } from "@/types/videoReview";

export type OpenAICreativeOutput = {
  result: CreativeScoreModelResult;
  model: string;
  raw: unknown;
};

export async function scoreCreativeWithOpenAI(
  input: CreativePromptInput,
): Promise<OpenAICreativeOutput> {
  const { apiKey, model } = await getOpenAIConfig();
  if (!apiKey) {
    throw new Error("Thiếu OPENAI_API_KEY để chấm điểm sáng tạo");
  }

  const rule = await getConfidenceRule();
  const userPrompt = buildCreativeScoreUserPrompt(input);

  const raw = await withRetry(
    async () => {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          temperature: 0.3,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: CREATIVE_SCORE_SYSTEM_PROMPT },
            { role: "user", content: userPrompt },
          ],
        }),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(`OpenAI error ${res.status}: ${t}`.slice(0, 500));
      }
      return res.json();
    },
    { retries: 3, label: "openai-creative" },
  );

  const text: string = raw?.choices?.[0]?.message?.content ?? "";
  const parsed = extractJson<Record<string, unknown>>(text);

  const result: CreativeScoreModelResult = {
    review_depth_score: coerceScore(parsed.review_depth_score),
    product_demo_score: coerceScore(parsed.product_demo_score),
    authenticity_score: coerceScore(parsed.authenticity_score),
    viral_hook_score: coerceScore(parsed.viral_hook_score),
    retention_score: coerceScore(parsed.retention_score),
    shareability_score: coerceScore(parsed.shareability_score),
    sales_conversion_score: coerceScore(parsed.sales_conversion_score),
    production_quality_score: coerceScore(parsed.production_quality_score),
    reasons: coerceStringArray(parsed.reasons),
    suggested_titles: coerceStringArray(parsed.suggested_titles),
    suggested_scripts: coerceStringArray(parsed.suggested_scripts),
    suggested_edits: coerceStringArray(parsed.suggested_edits),
    confidence: capConfidence(
      coerceConfidence(parsed.confidence),
      input.evidenceLevel === "video",
      rule,
    ),
  };

  return { result, model, raw };
}
