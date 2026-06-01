/**
 * Đọc/ghi DANH SÁCH NHÓM RỦI RO chính sách (admin cấu hình) từ app_settings.
 * Key: POLICY_RISK_GROUPS (JSON). Mặc định = 8 nhóm gốc → tái lập đúng hành vi cũ.
 * Server-only (dùng getSetting + admin client như policy-config.ts).
 *
 * Mỗi nhóm có `category` ("policy"|"copyright") và `critical_blocks`: dùng để
 * engine quyết định (final-decision) suy ra điều kiện reject KHÔNG cần hardcode key.
 * Mặc định: chỉ ip_trademark_risk là copyright + critical_blocks → giống coupling cũ.
 */
import { getSetting, invalidateSettingsCache } from "@/lib/secrets";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type RiskGroupCategory = "policy" | "copyright";

export type PolicyRiskGroup = {
  key: string; // id ổn định, snake_case — khớp field model trả về
  label_vi: string; // nhãn hiển thị cho nhân viên
  description_vi: string; // mô tả đưa vào prompt để AI chấm đúng
  category: RiskGroupCategory;
  critical_blocks: boolean; // nếu nhóm bị chấm "critical" → buộc reject theo category
  enabled: boolean;
};

const KEY = "POLICY_RISK_GROUPS";
const KEY_RE = /^[a-z][a-z0-9_]*$/;
const MAX_GROUPS = 20;

/** Key trùng field cố định trong JSON schema policy → cấm để khỏi hỏng parse. */
const RESERVED_KEYS = new Set<string>([
  "policy_safety_score",
  "copyright_safety_score",
  "risk_reasons",
  "policy_references",
  "suggested_fixes",
  "final_policy_level",
  "confidence",
]);

/** 8 nhóm gốc = đúng prompt + nhãn hiện hành (giữ nguyên hành vi). */
export const DEFAULT_RISK_GROUPS: PolicyRiskGroup[] = [
  {
    key: "misleading_claim_risk",
    label_vi: "Nói quá / gây hiểu lầm",
    description_vi: "tuyên bố sai/gây hiểu lầm, hứa hẹn quá đà",
    category: "policy",
    critical_blocks: false,
    enabled: true,
  },
  {
    key: "health_claim_risk",
    label_vi: "Hứa hẹn về sức khỏe / giảm cân",
    description_vi: "tuyên bố sức khỏe/giảm cân/chữa bệnh/cơ thể",
    category: "policy",
    critical_blocks: false,
    enabled: true,
  },
  {
    key: "personal_attribute_risk",
    label_vi: "Nhắm vào đặc điểm cá nhân",
    description_vi: "nhắm thuộc tính cá nhân (giới tính, tôn giáo, sức khỏe...)",
    category: "policy",
    critical_blocks: false,
    enabled: true,
  },
  {
    key: "before_after_risk",
    label_vi: "Hình ảnh trước / sau",
    description_vi: "hình ảnh trước/sau",
    category: "policy",
    critical_blocks: false,
    enabled: true,
  },
  {
    key: "shocking_content_risk",
    label_vi: "Nội dung gây sốc / giật gân",
    description_vi: "nội dung gây sốc/giật gân",
    category: "policy",
    critical_blocks: false,
    enabled: true,
  },
  {
    key: "adult_sensitive_risk",
    label_vi: "Nội dung nhạy cảm / người lớn",
    description_vi: "nội dung người lớn/nhạy cảm",
    category: "policy",
    critical_blocks: false,
    enabled: true,
  },
  {
    key: "ip_trademark_risk",
    label_vi: "Bản quyền / logo / người nổi tiếng / nhạc",
    description_vi:
      "bản quyền/thương hiệu/logo/người nổi tiếng/nhạc bản quyền",
    category: "copyright",
    critical_blocks: true,
    enabled: true,
  },
  {
    key: "restricted_product_risk",
    label_vi: "Sản phẩm bị hạn chế quảng cáo",
    description_vi: "sản phẩm bị hạn chế",
    category: "policy",
    critical_blocks: false,
    enabled: true,
  },
];

const DEFAULT_LABEL_BY_KEY: Record<string, string> = Object.fromEntries(
  DEFAULT_RISK_GROUPS.map((g) => [g.key, g.label_vi]),
);

function cloneDefault(): PolicyRiskGroup[] {
  return DEFAULT_RISK_GROUPS.map((g) => ({ ...g }));
}

/** Chuẩn hóa config: validate key, dedup, cap số nhóm; sai/rỗng → mặc định. */
export function parseRiskGroups(raw: unknown): PolicyRiskGroup[] {
  if (!Array.isArray(raw) || raw.length === 0) return cloneDefault();

  const out: PolicyRiskGroup[] = [];
  const seen = new Set<string>();

  for (const item of raw) {
    if (out.length >= MAX_GROUPS) break;
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;

    const key = String(obj.key ?? "")
      .trim()
      .toLowerCase();
    if (!KEY_RE.test(key) || RESERVED_KEYS.has(key) || seen.has(key)) continue;
    seen.add(key);

    const label_vi =
      String(obj.label_vi ?? "").trim() || DEFAULT_LABEL_BY_KEY[key] || key;
    const description_vi = String(obj.description_vi ?? "").trim();
    const category: RiskGroupCategory =
      obj.category === "copyright" ? "copyright" : "policy";
    const critical_blocks = Boolean(obj.critical_blocks);
    const enabled = obj.enabled === undefined ? true : Boolean(obj.enabled);

    out.push({ key, label_vi, description_vi, category, critical_blocks, enabled });
  }

  return out.length ? out : cloneDefault();
}

/** Đọc danh sách nhóm hiện hành (DB-first, fallback mặc định). */
export async function getRiskGroups(): Promise<PolicyRiskGroup[]> {
  const rawStr = await getSetting(KEY);
  if (!rawStr) return cloneDefault();
  try {
    return parseRiskGroups(JSON.parse(rawStr));
  } catch {
    return cloneDefault();
  }
}

/** Chỉ các nhóm đang bật — dùng cho prompt/parse/quyết định. */
export async function getEnabledRiskGroups(): Promise<PolicyRiskGroup[]> {
  return (await getRiskGroups()).filter((g) => g.enabled);
}

/** Lưu danh sách nhóm (admin). Chuẩn hóa trước khi ghi. */
export async function saveRiskGroups(
  raw: unknown,
  userId: string,
): Promise<PolicyRiskGroup[]> {
  const clean = parseRiskGroups(raw);
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
