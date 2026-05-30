/**
 * Đọc secret/config cho server. Hiện tại repo CHƯA có bảng app_secrets
 * DB-backed, nên đọc trực tiếp từ process.env (không hardcode giá trị).
 *
 * Thiết kế sẵn lớp cache TTL để sau này dễ chuyển sang DB-backed:
 * chỉ cần thay readRaw() để đọc DB trước, fallback env.
 *
 * TUYỆT ĐỐI chỉ dùng phía server.
 */

type CacheEntry = { value: string | undefined; at: number };
const TTL_MS = 60_000;
const cache = new Map<string, CacheEntry>();

function readRaw(key: string): string | undefined {
  // TODO(app_secrets): nếu sau này có bảng app_secrets, đọc DB ở đây trước,
  // rồi fallback về process.env. Hiện tại env-only.
  const v = process.env[key];
  return v && v.length > 0 ? v : undefined;
}

export function getSecret(key: string): string | undefined {
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && now - hit.at < TTL_MS) return hit.value;
  const value = readRaw(key);
  cache.set(key, { value, at: now });
  return value;
}

export function requireSecret(key: string): string {
  const v = getSecret(key);
  if (!v) {
    throw new Error(`Thiếu cấu hình bắt buộc: ${key}`);
  }
  return v;
}

export function getOpenAIConfig() {
  return {
    apiKey: getSecret("OPENAI_API_KEY"),
    model: getSecret("OPENAI_MODEL") ?? "gpt-4o-mini",
  };
}

export function getGeminiConfig() {
  return {
    apiKey: getSecret("GEMINI_API_KEY"),
    model: getSecret("GEMINI_MODEL") ?? "gemini-2.5-flash",
  };
}

export function getWorkerSecret(): string | undefined {
  return getSecret("VIDEO_REVIEW_WORKER_SECRET");
}
