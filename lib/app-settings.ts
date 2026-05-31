/**
 * Quản lý app_settings (server-only, service role). Định nghĩa các key được
 * phép quản lý qua UI + đọc trạng thái có che (mask) cho secret + hướng dẫn lấy.
 */
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type SettingGroup =
  | "AI"
  | "Google Drive"
  | "Google Drive (cá nhân)"
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
  /** Các bước hướng dẫn lấy giá trị. */
  guide?: string[];
  /** Link tới trang chính thức để lấy. */
  guideUrl?: string;
  guideUrlLabel?: string;
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
    guideUrl: "https://platform.openai.com/api-keys",
    guideUrlLabel: "platform.openai.com/api-keys",
    guide: [
      "Đăng nhập platform.openai.com.",
      "Mở mục API keys (góc phải trên → Your profile → API keys).",
      'Bấm "Create new secret key" → đặt tên → Create.',
      "Copy key (dạng sk-...) NGAY — chỉ hiện 1 lần duy nhất.",
      "Vào Settings → Billing nạp tối thiểu vài USD thì key mới gọi được.",
      "Dán vào ô trên rồi Lưu cấu hình.",
    ],
  },
  {
    key: "OPENAI_MODEL",
    label: "OpenAI Model",
    group: "AI",
    isSecret: false,
    placeholder: "gpt-4o-mini",
    help: "Để trống = dùng mặc định gpt-4o-mini (rẻ). Có thể đổi gpt-4o, gpt-4.1-mini…",
  },
  {
    key: "GEMINI_API_KEY",
    label: "Gemini API Key",
    group: "AI",
    isSecret: true,
    placeholder: "AIza...",
    help: "Dùng cho phân tích nội dung video.",
    guideUrl: "https://aistudio.google.com/app/apikey",
    guideUrlLabel: "aistudio.google.com/app/apikey",
    guide: [
      "Mở aistudio.google.com/app/apikey và đăng nhập Google.",
      'Bấm "Create API key" → chọn (hoặc tạo) một Google Cloud project.',
      "Copy key (dạng AIza...).",
      "Gói free tier dùng được ngay (có giới hạn request/phút).",
      "Dán vào ô trên rồi Lưu cấu hình.",
    ],
  },
  {
    key: "GEMINI_MODEL",
    label: "Gemini Model",
    group: "AI",
    isSecret: false,
    placeholder: "gemini-2.5-flash",
    help: "Để trống = dùng mặc định gemini-2.5-flash. Có thể đổi gemini-2.5-pro…",
  },
  {
    key: "GOOGLE_DRIVE_CLIENT_EMAIL",
    label: "Drive Service Account Email",
    group: "Google Drive",
    isSecret: false,
    placeholder: "xxx@yyy.iam.gserviceaccount.com",
    help: "Lấy từ file JSON service account (trường client_email).",
    guideUrl: "https://console.cloud.google.com/apis/credentials",
    guideUrlLabel: "console.cloud.google.com → Credentials",
    guide: [
      "Vào console.cloud.google.com → tạo (hoặc chọn) 1 project.",
      'APIs & Services → Library → tìm "Google Drive API" → Enable.',
      "APIs & Services → Credentials → Create credentials → Service account.",
      "Tạo xong, mở service account → tab Keys → Add key → Create new key → JSON → tải file về.",
      "Mở file JSON: copy giá trị client_email dán vào ô này.",
      "(Giá trị private_key dán vào ô Drive Private Key bên dưới.)",
    ],
  },
  {
    key: "GOOGLE_DRIVE_PRIVATE_KEY",
    label: "Drive Private Key",
    group: "Google Drive",
    isSecret: true,
    multiline: true,
    placeholder: "-----BEGIN PRIVATE KEY-----\\n...",
    help: "Lấy từ file JSON service account (trường private_key). Dán nguyên (giữ \\n hoặc xuống dòng thật đều được).",
    guide: [
      "Mở file JSON service account đã tải ở bước trên.",
      'Copy toàn bộ giá trị của trường "private_key".',
      "Bao gồm cả dòng -----BEGIN PRIVATE KEY----- và -----END PRIVATE KEY-----.",
      "Dán nguyên vào ô này (hệ thống tự xử lý ký tự \\n).",
    ],
  },
  {
    key: "GOOGLE_DRIVE_FOLDER_ID",
    label: "Drive Folder ID",
    group: "Google Drive",
    isSecret: false,
    help: "ID folder Drive chứa video upload.",
    guide: [
      "Tạo 1 folder trên Google Drive (drive.google.com).",
      "Mở folder, nhìn URL: drive.google.com/drive/folders/<ID> → phần <ID> là Folder ID.",
      "Bấm Share folder → thêm email service account (ô Drive Service Account Email) → quyền Editor.",
      "Dán <ID> vào ô này.",
    ],
  },
  {
    key: "GOOGLE_SHEET_ID",
    label: "Google Sheet ID (lưu dữ liệu)",
    group: "Google Sheet",
    isSecret: false,
    help: "ID Google Sheet để lưu/đồng bộ dữ liệu.",
    guide: [
      "Tạo 1 Google Sheet (sheets.new).",
      "Nhìn URL: docs.google.com/spreadsheets/d/<ID>/edit → phần <ID> là Sheet ID.",
      "Bấm Share → thêm email service account (cùng cái dùng cho Drive) → quyền Editor.",
      'Vào Cloud Console → Library → bật "Google Sheets API".',
      "Dán <ID> vào ô này.",
    ],
  },
  {
    key: "GOOGLE_OAUTH_CLIENT_ID",
    label: "Google OAuth Client ID (lưu video vào Drive của bạn)",
    group: "Google Drive (cá nhân)",
    isSecret: false,
    placeholder: "xxxx.apps.googleusercontent.com",
    help: "Để video lưu vào Drive CÁ NHÂN của bạn (dùng quota 15GB của bạn).",
    guide: [
      "console.cloud.google.com → APIs & Services → bật Google Drive API.",
      "OAuth consent screen: chọn External, thêm email bạn vào Test users.",
      'Credentials → Create credentials → OAuth client ID → loại "Web application".',
      "Authorized redirect URIs (KHÔNG phải JavaScript origins) thêm: https://timvideo.vercel.app/api/auth/google/callback",
      "Copy Client ID dán vào đây, Client Secret dán ô dưới, rồi Lưu cấu hình.",
      'Cuối cùng bấm nút "Kết nối Google Drive" ở thẻ dưới.',
    ],
  },
  {
    key: "GOOGLE_OAUTH_CLIENT_SECRET",
    label: "Google OAuth Client Secret",
    group: "Google Drive (cá nhân)",
    isSecret: true,
    placeholder: "GOCSPX-...",
    help: "Client Secret của OAuth client ở trên.",
  },
  {
    key: "VIDEO_REVIEW_WORKER_SECRET",
    label: "Worker Secret",
    group: "Worker",
    isSecret: true,
    help: "Bí mật gọi /api/cron/video-review từ ngoài (Authorization: Bearer …).",
    guide: [
      "Tự nghĩ 1 chuỗi ngẫu nhiên dài (≥ 32 ký tự).",
      "Gợi ý tạo nhanh: chạy `openssl rand -hex 32` hoặc dùng trình tạo mật khẩu.",
      "KHÔNG bắt buộc nếu chỉ dùng Vercel Cron tự động (đã cấu hình mỗi 2 phút).",
      "Chỉ cần khi bạn muốn tự gọi worker từ công cụ ngoài.",
    ],
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
  guide: string[];
  guideUrl: string | null;
  guideUrlLabel: string | null;
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
    guide: def.guide ?? [],
    guideUrl: def.guideUrl ?? null,
    guideUrlLabel: def.guideUrlLabel ?? null,
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
