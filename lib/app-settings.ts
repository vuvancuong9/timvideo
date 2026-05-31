/**
 * Quản lý app_settings (server-only, service role). Định nghĩa các key được
 * phép quản lý qua UI + đọc trạng thái có che (mask) cho secret.
 */
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type SettingGroup =
  | "AI"
  | "Google Drive"
  | "Google Sheet"
  | "Worker"
  | "Hệ thống";

export type SettingDef = {
  key: string;
  label: string;
  group: SettingGroup;
  isSecret: boolean;
  multiline?: boolean;
  placeholder?: string;
  help?: string;
};

/** Các key admin được điền/sửa qua UI (lưu DB, fallback env). */
export const MANAGED_SETTINGS: SettingDef[] = [
  {
    key: "OPENAI_API_KEY",
    label: "OpenAI API Key",
    group: "AI",
    isSecret: true,
    placeholder: "sk-...",
    help: "Dùng cho chấm rủi ro chính sách Facebook + creative scoring.",
  },
  {
    key: "OPENAI_MODEL",
    label: "OpenAI Model",
    group: "AI",
    isSecret: false,
    placeholder: "gpt-4o-mini",
  },
  {
    key: "GEMINI_API_KEY",
    label: "Gemini API Key",
    group: "AI",
    isSecret: true,
    placeholder: "AIza...",
    help: "Dùng cho phân tích nội dung video.",
  },
  {
    key: "GEMINI_MODEL",
    label: "Gemini Model",
    group: "AI",
    isSecret: false,
    placeholder: "gemini-2.5-flash",
  },
  {
    key: "GOOGLE_DRIVE_CLIENT_EMAIL",
    label: "Drive Service Account Email",
    group: "Google Drive",
    isSecret: false,
    placeholder: "xxx@yyy.iam.gserviceaccount.com",
  },
  {
    key: "GOOGLE_DRIVE_PRIVATE_KEY",
    label: "Drive Private Key",
    group: "Google Drive",
    isSecret: true,
    multiline: true,
    placeholder: "-----BEGIN PRIVATE KEY-----\\n...",
    help: "Dán nguyên private key (giữ \\n hoặc xuống dòng thật đều được).",
  },
  {
    key: "GOOGLE_DRIVE_FOLDER_ID",
    label: "Drive Folder ID",
    group: "Google Drive",
    isSecret: false,
    help: "ID folder Drive chứa video upload. Share folder cho service account (Editor).",
  },
  {
    key: "GOOGLE_SHEET_ID",
    label: "Google Sheet ID (lưu dữ liệu)",
    group: "Google Sheet",
    isSecret: false,
    help: "ID Google Sheet để lưu/đồng bộ dữ liệu. Share sheet cho cùng service account Drive (Editor) + bật Google Sheets API.",
  },
  {
    key: "VIDEO_REVIEW_WORKER_SECRET",
    label: "Worker Secret",
    group: "Worker",
    isSecret: true,
    help: "Bí mật gọi /api/cron/video-review từ ngoài (Authorization: Bearer ...).",
  },
];

/** Key hạ tầng — CHỈ hiển thị trạng thái, KHÔNG sửa qua UI (phải set ở Vercel env). */
export const SYSTEM_SETTINGS: SettingDef[] = [
  {
    key: "NEXT_PUBLIC_SUPABASE_URL",
    label: "Supabase URL",
    group: "Hệ thống",
    isSecret: false,
  },
  {
    key: "SUPABASE_SERVICE_ROLE_KEY",
    label: "Supabase Service Role Key",
    group: "Hệ thống",
    isSecret: true,
  },
  {
    key: "ADMIN_EMAILS",
    label: "Admin Emails",
    group: "Hệ thống",
    isSecret: false,
  },
];

export type SettingStatus = {
  key: string;
  label: string;
  group: SettingGroup;
  isSecret: boolean;
  multiline: boolean;
  placeholder: string | null;
  help: string | null;
  hasValue: boolean;
  source: "db" | "env" | "none";
  preview: string | null;
};

function mask(value: string, isSecret: boolean): string {
  if (!isSecret) return value;
  const tail = value.length > 4 ? value.slice(-4) : "";
  return `••••${tail}`;
}

function toStatus(
  def: SettingDef,
  dbVal: string,
  allowDb: boolean,
): SettingStatus {
  const envVal = process.env[def.key] ?? "";
  const effective = allowDb && dbVal ? dbVal : envVal;
  const source: SettingStatus["source"] =
    allowDb && dbVal ? "db" : envVal ? "env" : "none";
  return {
    key: def.key,
    label: def.label,
    group: def.group,
    isSecret: def.isSecret,
    multiline: Boolean(def.multiline),
    placeholder: def.placeholder ?? null,
    help: def.help ?? null,
    hasValue: effective.length > 0,
    source,
    preview: effective ? mask(effective, def.isSecret) : null,
  };
}

export async function getManagedSettingsStatus(): Promise<{
  managed: SettingStatus[];
  system: SettingStatus[];
}> {
  const dbMap = new Map<string, string>();
  try {
    const admin = createSupabaseAdminClient();
    const { data } = await admin.from("app_settings").select("key,value");
    for (const r of data ?? []) {
      if (r.value) dbMap.set(r.key, r.value);
    }
  } catch {
    // không có service role → chỉ hiện trạng thái theo env
  }
  return {
    managed: MANAGED_SETTINGS.map((d) => toStatus(d, dbMap.get(d.key) ?? "", true)),
    system: SYSTEM_SETTINGS.map((d) => toStatus(d, "", false)),
  };
}

const MANAGED_KEYS = new Set(MANAGED_SETTINGS.map((s) => s.key));
const SECRET_BY_KEY = new Map(MANAGED_SETTINGS.map((s) => [s.key, s.isSecret]));

export async function setManagedSettings(
  values: Record<string, unknown>,
  clear: string[],
  userId: string,
): Promise<{ updated: string[]; cleared: string[] }> {
  const admin = createSupabaseAdminClient();
  const nowIso = new Date().toISOString();

  const upserts = Object.entries(values)
    .filter(
      ([k, v]) =>
        MANAGED_KEYS.has(k) && typeof v === "string" && v.trim().length > 0,
    )
    .map(([k, v]) => ({
      key: k,
      value: (v as string).trim(),
      is_secret: SECRET_BY_KEY.get(k) ?? false,
      updated_by: userId,
      updated_at: nowIso,
    }));

  if (upserts.length > 0) {
    const { error } = await admin
      .from("app_settings")
      .upsert(upserts, { onConflict: "key" });
    if (error) throw error;
  }

  const clearKeys = (clear ?? []).filter((k) => MANAGED_KEYS.has(k));
  if (clearKeys.length > 0) {
    const { error } = await admin
      .from("app_settings")
      .delete()
      .in("key", clearKeys);
    if (error) throw error;
  }

  return { updated: upserts.map((u) => u.key), cleared: clearKeys };
}
