/**
 * Đọc secret/config cho server: ƯU TIÊN DB (bảng app_settings, qua service role),
 * FALLBACK process.env. Cache 60s để giảm round-trip.
 *
 * SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_* / ADMIN_EMAILS luôn đọc
 * thẳng từ env (không nằm trong app_settings) vì cần để kết nối DB trước.
 *
 * TUYỆT ĐỐI chỉ dùng phía server.
 */
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

let cache: Map<string, string> | null = null;
let cacheAt = 0;
const TTL_MS = 60_000;

async function loadFromDb(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    const admin = createSupabaseAdminClient();
    const { data } = await admin.from("app_settings").select("key,value");
    for (const r of data ?? []) {
      if (r.value && r.value.length > 0) map.set(r.key, r.value);
    }
  } catch {
    // Thiếu service role / bảng chưa có → bỏ qua, fallback env.
  }
  return map;
}

async function ensureLoaded(): Promise<Map<string, string>> {
  const now = Date.now();
  if (cache && now - cacheAt < TTL_MS) return cache;
  cache = await loadFromDb();
  cacheAt = now;
  return cache;
}

/** Gọi sau khi admin cập nhật settings để áp dụng ngay (không chờ TTL). */
export function invalidateSettingsCache(): void {
  cache = null;
  cacheAt = 0;
}

/** Lấy 1 setting: DB trước, env sau. */
export async function getSetting(key: string): Promise<string | undefined> {
  const map = await ensureLoaded();
  const dbVal = map.get(key);
  if (dbVal && dbVal.length > 0) return dbVal;
  const envVal = process.env[key];
  return envVal && envVal.length > 0 ? envVal : undefined;
}

export async function requireSetting(key: string): Promise<string> {
  const v = await getSetting(key);
  if (!v) throw new Error(`Thiếu cấu hình bắt buộc: ${key}`);
  return v;
}

export async function getOpenAIConfig() {
  return {
    apiKey: await getSetting("OPENAI_API_KEY"),
    model: (await getSetting("OPENAI_MODEL")) ?? "gpt-4o-mini",
  };
}

export async function getGeminiConfig() {
  return {
    apiKey: await getSetting("GEMINI_API_KEY"),
    model: (await getSetting("GEMINI_MODEL")) ?? "gemini-2.5-flash",
  };
}

export async function getWorkerSecret(): Promise<string | undefined> {
  return getSetting("VIDEO_REVIEW_WORKER_SECRET");
}
