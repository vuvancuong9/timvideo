/**
 * Tiện ích chung cho gọi AI: retry backoff, trích JSON, ép kiểu enum/score.
 * Server-only.
 */
import type { AnalysisConfidence, RiskLevel } from "@/types/videoReview";

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { retries?: number; baseDelayMs?: number; label?: string } = {},
): Promise<T> {
  const retries = opts.retries ?? 3;
  const base = opts.baseDelayMs ?? 800;
  let lastErr: unknown;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < retries - 1) {
        const delay = base * Math.pow(2, attempt);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastErr;
}

/** Trích object JSON đầu tiên từ text (chịu được ```json fences / lời dẫn). */
export function extractJson<T = unknown>(text: string): T {
  const cleaned = text.replace(/```json/gi, "```").trim();
  const fenced = cleaned.match(/```\s*([\s\S]*?)\s*```/);
  const candidate = fenced ? fenced[1] : cleaned;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Không tìm thấy JSON trong phản hồi AI");
  }
  const json = candidate.slice(start, end + 1);
  return JSON.parse(json) as T;
}

export function coerceRisk(v: unknown): RiskLevel {
  const s = String(v ?? "").toLowerCase();
  if (s === "low" || s === "medium" || s === "high" || s === "critical") {
    return s;
  }
  return "low";
}

export function coerceConfidence(v: unknown): AnalysisConfidence {
  const s = String(v ?? "").toLowerCase();
  if (s === "low" || s === "medium" || s === "high") return s;
  return "medium";
}

/** Ép số về 0..100. */
export function coerceScore(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n * 100) / 100));
}

export function coerceStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).slice(0, 50);
}
