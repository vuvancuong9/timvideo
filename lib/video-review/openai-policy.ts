/**
 * OpenAI Facebook policy risk check (STAGE 4). Server-only.
 * Gọi OpenAI Chat Completions REST — không thêm SDK. Trả strict JSON.
 */
import { getOpenAIConfig } from "@/lib/secrets";
import {
  buildFacebookPolicySystemPrompt,
  buildFacebookPolicyUserPrompt,
  type PolicyPromptInput,
} from "@/lib/video-review/prompts/facebook-policy";
import { getEnabledRiskGroups } from "@/lib/video-review/policy-groups-config";
import {
  capConfidence,
  getConfidenceRule,
} from "@/lib/video-review/confidence-config";
import {
  coerceConfidence,
  coerceRisk,
  coerceScore,
  coerceStringArray,
  extractJson,
  withRetry,
} from "@/lib/video-review/ai-util";
import type { PolicyCheckResult, RiskLevel } from "@/types/videoReview";

export type OpenAIPolicyOutput = {
  result: PolicyCheckResult;
  model: string;
  raw: unknown;
};

export async function checkPolicyWithOpenAI(
  input: PolicyPromptInput,
): Promise<OpenAIPolicyOutput> {
  const { apiKey, model } = await getOpenAIConfig();
  if (!apiKey) {
    throw new Error("Thiếu OPENAI_API_KEY để kiểm tra chính sách");
  }

  const groups = await getEnabledRiskGroups();
  const rule = await getConfidenceRule();
  const userPrompt = buildFacebookPolicyUserPrompt(input, groups);

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
            {
              role: "system",
              content: buildFacebookPolicySystemPrompt(groups),
            },
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

  // Mỗi nhóm cấu hình → 1 mức rủi ro. Khóa AI thiếu → coerceRisk(undefined)="low" (an toàn).
  const risk_scores: Record<string, RiskLevel> = {};
  for (const g of groups) {
    risk_scores[g.key] = coerceRisk(parsed[g.key]);
  }

  const result: PolicyCheckResult = {
    policy_safety_score: coerceScore(parsed.policy_safety_score),
    copyright_safety_score: coerceScore(parsed.copyright_safety_score),
    risk_scores,
    risk_reasons: coerceStringArray(parsed.risk_reasons),
    policy_references: coerceStringArray(parsed.policy_references),
    suggested_fixes: coerceStringArray(parsed.suggested_fixes),
    final_policy_level: coerceRisk(parsed.final_policy_level),
    confidence: capConfidence(
      coerceConfidence(parsed.confidence),
      input.hasVideoFile,
      rule,
    ),
  };

  return { result, model, raw };
}
