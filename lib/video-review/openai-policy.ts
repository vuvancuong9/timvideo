/**
 * OpenAI Facebook policy risk check (STAGE 4). Server-only.
 * Gọi OpenAI Chat Completions REST — không thêm SDK. Trả strict JSON.
 */
import { getOpenAIConfig } from "@/lib/secrets";
import {
  FACEBOOK_POLICY_SYSTEM_PROMPT,
  buildFacebookPolicyUserPrompt,
  type PolicyPromptInput,
} from "@/lib/video-review/prompts/facebook-policy";
import {
  capConfidenceWhenNoFile,
  coerceConfidence,
  coerceRisk,
  coerceScore,
  coerceStringArray,
  extractJson,
  withRetry,
} from "@/lib/video-review/ai-util";
import type { PolicyCheckResult } from "@/types/videoReview";

export type OpenAIPolicyOutput = {
  result: PolicyCheckResult;
  model: string;
  raw: unknown;
};

export async function checkPolicyWithOpenAI(
  input: PolicyPromptInput,
): Promise<OpenAIPolicyOutput> {
  const { apiKey, model } = getOpenAIConfig();
  if (!apiKey) {
    throw new Error("Thiếu OPENAI_API_KEY để kiểm tra chính sách");
  }

  const userPrompt = buildFacebookPolicyUserPrompt(input);

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
          temperature: 0.2,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: FACEBOOK_POLICY_SYSTEM_PROMPT },
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
    { retries: 3, label: "openai-policy" },
  );

  const text: string = raw?.choices?.[0]?.message?.content ?? "";
  const parsed = extractJson<Record<string, unknown>>(text);

  const result: PolicyCheckResult = {
    policy_safety_score: coerceScore(parsed.policy_safety_score),
    copyright_safety_score: coerceScore(parsed.copyright_safety_score),
    misleading_claim_risk: coerceRisk(parsed.misleading_claim_risk),
    health_claim_risk: coerceRisk(parsed.health_claim_risk),
    personal_attribute_risk: coerceRisk(parsed.personal_attribute_risk),
    before_after_risk: coerceRisk(parsed.before_after_risk),
    shocking_content_risk: coerceRisk(parsed.shocking_content_risk),
    adult_sensitive_risk: coerceRisk(parsed.adult_sensitive_risk),
    ip_trademark_risk: coerceRisk(parsed.ip_trademark_risk),
    restricted_product_risk: coerceRisk(parsed.restricted_product_risk),
    risk_reasons: coerceStringArray(parsed.risk_reasons),
    policy_references: coerceStringArray(parsed.policy_references),
    suggested_fixes: coerceStringArray(parsed.suggested_fixes),
    final_policy_level: coerceRisk(parsed.final_policy_level),
    confidence: capConfidenceWhenNoFile(
      coerceConfidence(parsed.confidence),
      input.hasVideoFile,
    ),
  };

  return { result, model, raw };
}
