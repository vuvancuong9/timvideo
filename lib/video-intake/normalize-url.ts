/**
 * Chuẩn hóa URL video + nhận diện nguồn để chống trùng.
 *
 * File này PURE — KHÔNG import module Node, an toàn cho cả client lẫn server.
 * Phần băm (hashCanonicalUrl, cần node:crypto) nằm ở lib/video-intake/duplicate.ts
 * để tránh bundle node:crypto vào client. (Ghi chú: spec đặt hashCanonicalUrl
 * trong file này; tách ra để giữ client-safe.)
 */
import type { VideoSourceType } from "@/types/videoIntake";

/** Tracking params cần loại bỏ (so khớp chính xác, không phân biệt hoa thường). */
const TRACKING_PARAM_EXACT = new Set([
  "fbclid",
  "gclid",
  "dclid",
  "gclsrc",
  "spm",
  "aff",
  "aff_id",
  "affiliate",
  "ref",
  "ref_src",
  "ref_url",
  "refid",
  "source",
  "share_id",
  "igshid",
  "igsh",
  "mibextid",
  "si",
  "feature",
  "app",
  "_r",
  "_t",
  "_d",
  "is_from_webapp",
  "sender_device",
  "web_id",
  "share_app_id",
  "share_link_id",
  "share_item_id",
  "social_sharing",
  "timestamp",
  "u_code",
  "tt_from",
  "checksum",
  "enter_method",
]);

const TRACKING_PARAM_PREFIX = ["utm_"];

function isTrackingParam(key: string): boolean {
  const k = key.toLowerCase();
  if (TRACKING_PARAM_EXACT.has(k)) return true;
  return TRACKING_PARAM_PREFIX.some((p) => k.startsWith(p));
}

function parseUrl(raw: string): URL | null {
  const s = (raw ?? "").trim();
  if (!s) return null;
  const withProto = /^https?:\/\//i.test(s) ? s : `https://${s}`;
  try {
    return new URL(withProto);
  } catch {
    return null;
  }
}

/** Hạ hostname: lowercase, bỏ "www." và "m." đầu. */
function normalizeHost(host: string): string {
  let h = host.toLowerCase();
  if (h.startsWith("www.")) h = h.slice(4);
  if (h.startsWith("m.")) h = h.slice(2);
  return h;
}

function sourceFromHost(host: string): VideoSourceType {
  if (
    host === "youtu.be" ||
    host.endsWith(".youtu.be") ||
    host.includes("youtube.com")
  ) {
    return "youtube_url";
  }
  if (host.includes("tiktok.com")) return "tiktok_url";
  if (
    host.includes("facebook.com") ||
    host === "fb.watch" ||
    host.endsWith(".fb.watch") ||
    host.includes("fb.com")
  ) {
    return "facebook_url";
  }
  return "other_url";
}

/** Nhận diện nguồn video từ URL thô (không bao giờ trả 'drive_upload'). */
export function detectVideoSource(url: string): VideoSourceType {
  const u = parseUrl(url);
  if (!u) return "other_url";
  return sourceFromHost(normalizeHost(u.hostname));
}

/** Bỏ tracking params khỏi URL, trả về URL mới (không mutate input). */
export function stripTrackingParams(url: URL): URL {
  const out = new URL(url.toString());
  const keys = Array.from(out.searchParams.keys());
  for (const k of keys) {
    if (isTrackingParam(k)) out.searchParams.delete(k);
  }
  return out;
}

function stripTrailingSlash(path: string): string {
  const p = path.replace(/\/+$/, "");
  return p === "" ? "/" : p;
}

function extractYouTubeId(u: URL, host: string): string | null {
  if (host === "youtu.be" || host.endsWith(".youtu.be")) {
    const id = u.pathname.split("/").filter(Boolean)[0];
    return id || null;
  }
  const v = u.searchParams.get("v");
  if (v) return v;
  const parts = u.pathname.split("/").filter(Boolean);
  if (parts.length >= 2 && ["shorts", "embed", "v", "live"].includes(parts[0])) {
    return parts[1];
  }
  return null;
}

/**
 * Canonical URL ổn định cho chống trùng.
 * - trim, lowercase hostname, bỏ www/m, bỏ tracking params
 * - YouTube  → https://www.youtube.com/watch?v=<id>
 * - TikTok   → https://www.tiktok.com/@user/video/<id> (bỏ query)
 *              vm.tiktok.com short link: giữ nguyên path (không resolve được client-side)
 * - Facebook → https://www.facebook.com<path chính> (reel/watch/videos), bỏ tracking
 * - Other    → origin + pathname + search (đã bỏ tracking, sort)
 */
export function canonicalizeVideoUrl(url: string): string {
  const u = parseUrl(url);
  if (!u) return (url ?? "").trim().toLowerCase();

  const host = normalizeHost(u.hostname);
  const source = sourceFromHost(host);

  if (source === "youtube_url") {
    const id = extractYouTubeId(u, host);
    if (id) return `https://www.youtube.com/watch?v=${id}`;
    // không lấy được id -> generic phía dưới
  }

  if (source === "tiktok_url") {
    // vm.tiktok.com / vt.tiktok.com short link: không resolve được, giữ path hiện có
    return `https://www.tiktok.com${stripTrailingSlash(u.pathname)}`;
  }

  if (source === "facebook_url") {
    const path = stripTrailingSlash(u.pathname);
    const kept = new URLSearchParams();
    const v = u.searchParams.get("v");
    const storyFbid = u.searchParams.get("story_fbid");
    const id = u.searchParams.get("id");
    if (v) kept.set("v", v);
    if (storyFbid) kept.set("story_fbid", storyFbid);
    if (id && storyFbid) kept.set("id", id);
    const qs = kept.toString();
    return `https://www.facebook.com${path}${qs ? `?${qs}` : ""}`;
  }

  // generic / other
  const stripped = stripTrackingParams(u);
  const entries = Array.from(stripped.searchParams.entries()).sort((a, b) =>
    a[0].localeCompare(b[0]),
  );
  const params = new URLSearchParams();
  for (const [k, val] of entries) params.append(k, val);
  const qs = params.toString();
  return `https://${host}${stripTrailingSlash(stripped.pathname)}${qs ? `?${qs}` : ""}`;
}
