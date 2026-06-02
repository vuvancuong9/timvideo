/**
 * Đọc/ghi ngưỡng quyết định (DecisionThresholds) từ app_settings (server-only).
 * Key: POLICY_THRESHOLDS (JSON). Có default = DEFAULT_THRESHOLDS nếu chưa cấu hình.
 */
import { getSetting } from "@/lib/secrets";
import { invalidateSettingsCache } from "@/lib/secrets";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  DEFAULT_THRESHOLDS,
  type DecisionThresholds,
} from "@/lib/video-review/final-decision";

const KEY = "POLICY_THRESHOLDS";

/** Các trường số hợp lệ + ràng buộc nhẹ (0..1 cho trọng số, 0..100 cho ngưỡng). */
const NUMERIC_KEYS: (keyof DecisionThresholds)[] = [
  "w_review_depth",
  "w_viral_hook",
  "w_retention",
  "w_authenticity",
  "w_product_demo",
  "w_sales_conversion",
  "reject_policy_below",
  "reject_copyright_below",
  "need_edit_policy_below",
  "review_depth_reject_below",
  "review_depth_need_edit_below",
  "approve_content_min",
  "approve_review_depth_min",
  "approve_policy_min",
  "approve_copyright_min",
  "low_quality_below",
  "need_edit_content_below",
];

/** Trộn config DB lên default; bỏ qua field không hợp lệ. */
export function parseThresholds(raw: unknown): DecisionThresholds {
  const out: DecisionThresholds = { ...DEFAULT_THRESHOLDS };
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    for (const k of NUMERIC_KEYS) {
      const v = obj[k];
      if (typeof v === "number" && Number.isFinite(v)) {
        out[k] = v;
      }
    }
  }
  return out;
}

/** Đọc thresholds hiện hành (DB-first, fallback default). */
export async function getThresholds(): Promise<DecisionThresholds> {
  const rawStr = await getSetting(KEY);
  if (!rawStr) return { ...DEFAULT_THRESHOLDS };
  try {
    return parseThresholds(JSON.parse(rawStr));
  } catch {
    return { ...DEFAULT_THRESHOLDS };
  }
}

/** Lưu thresholds (admin). Chuẩn hóa qua parseThresholds trước khi ghi. */
export async function saveThresholds(
  raw: unknown,
  userId: string,
): Promise<DecisionThresholds> {
  const clean = parseThresholds(raw);
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
