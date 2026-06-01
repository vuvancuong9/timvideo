/**
 * Đọc/ghi LUẬT ĐỘ TIN CẬY (confidence) — admin cấu hình, lưu app_settings.
 * Key: POLICY_CONFIDENCE_RULE (JSON). Mặc định = đúng hành vi capConfidenceWhenNoFile cũ.
 * Server-only cho get/save; capConfidence là hàm thuần (dùng được mọi nơi).
 */
import { getSetting, invalidateSettingsCache } from "@/lib/secrets";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { AnalysisConfidence } from "@/types/videoReview";

export type ConfidenceRule = {
  /** Khi KHÔNG có file video, confidence bị cap tối đa ở mức này. */
  no_file_max: "low" | "medium";
  /** Có file video thì cho phép confidence "high" hay không. */
  allow_high_with_file: boolean;
  /** Các dòng giải thích hiển thị cho admin/nhân viên. */
  notes_vi: string[];
};

const KEY = "POLICY_CONFIDENCE_RULE";
const MAX_NOTES = 20;

export const DEFAULT_CONFIDENCE_RULE: ConfidenceRule = {
  no_file_max: "medium",
  allow_high_with_file: true,
  notes_vi: [
    "Chỉ có link ngoài, KHÔNG có file video → confidence bị giới hạn ở mức ≤ medium.",
    "Có file video upload Drive → cho phép confidence high.",
    "Hệ thống KHÔNG khẳng định chắc chắn Facebook duyệt/không duyệt.",
  ],
};

const RANK: Record<AnalysisConfidence, number> = { low: 0, medium: 1, high: 2 };

function capTo(
  c: AnalysisConfidence,
  max: AnalysisConfidence,
): AnalysisConfidence {
  return RANK[c] <= RANK[max] ? c : max;
}

/**
 * Áp luật confidence. Mặc định (no_file_max:"medium", allow_high_with_file:true)
 * TÁI LẬP ĐÚNG capConfidenceWhenNoFile cũ: không file → hạ "high"→"medium"; có file → giữ nguyên.
 */
export function capConfidence(
  c: AnalysisConfidence,
  hasVideoFile: boolean,
  rule: ConfidenceRule,
): AnalysisConfidence {
  if (!hasVideoFile) return capTo(c, rule.no_file_max);
  if (!rule.allow_high_with_file && c === "high") return rule.no_file_max;
  return c;
}

/** Chuẩn hóa config: trộn lên mặc định, bỏ field sai. */
export function parseConfidenceRule(raw: unknown): ConfidenceRule {
  const out: ConfidenceRule = {
    ...DEFAULT_CONFIDENCE_RULE,
    notes_vi: [...DEFAULT_CONFIDENCE_RULE.notes_vi],
  };
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    if (obj.no_file_max === "low" || obj.no_file_max === "medium") {
      out.no_file_max = obj.no_file_max;
    }
    if (typeof obj.allow_high_with_file === "boolean") {
      out.allow_high_with_file = obj.allow_high_with_file;
    }
    if (Array.isArray(obj.notes_vi)) {
      out.notes_vi = obj.notes_vi
        .map((x) => String(x ?? "").trim())
        .filter((s) => s.length > 0)
        .slice(0, MAX_NOTES);
    }
  }
  return out;
}

/** Đọc luật confidence hiện hành (DB-first, fallback mặc định). */
export async function getConfidenceRule(): Promise<ConfidenceRule> {
  const rawStr = await getSetting(KEY);
  if (!rawStr) return { ...DEFAULT_CONFIDENCE_RULE };
  try {
    return parseConfidenceRule(JSON.parse(rawStr));
  } catch {
    return { ...DEFAULT_CONFIDENCE_RULE };
  }
}

/** Lưu luật confidence (admin). */
export async function saveConfidenceRule(
  raw: unknown,
  userId: string,
): Promise<ConfidenceRule> {
  const clean = parseConfidenceRule(raw);
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("app_settings").upsert(
    {
      key: KEY,
      value: JSON.stringify(clean),
      is_secret: false,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );
  if (error) throw error;
  invalidateSettingsCache();
  return clean;
}
