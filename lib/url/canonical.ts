/**
 * Chuẩn hóa URL video để chống trùng.
 * File này KHÔNG import module Node (an toàn cho cả client lẫn server).
 * Phần băm (hash) nằm ở lib/url/hash.ts (chỉ server/test).
 */
import type { VideoSource } from "@/lib/constants";

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
  "share_id",
  "enter_method",
]);

/** Tracking params loại bỏ theo tiền tố. */
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

/** Hạ hostname về dạng chuẩn: lowercase, bỏ "www." và "m." đầu. */
function normalizeHost(host: string): string {
  let h = host.toLowerCase();
  if (h.startsWith("www.")) h = h.slice(4);
  if (h.startsWith("m.")) h = h.slice(2);
  return h;
}

function sourceFromHost(host: string): VideoSource {
  if (
    host === "youtu.be" ||
    host.endsWith(".youtu.be") ||
    host.includes("youtube.com")
  ) {
    return "youtube";
  }
  if (host.includes("tiktok.com")) return "tiktok";
  if (
    host.includes("facebook.com") ||
    host === "fb.watch" ||
    host.endsWith(".fb.watch") ||
    host.includes("fb.com")
  ) {
    return "facebook";
  }
  return "other";
}

/** Nhận diện nguồn video từ URL thô. */
export function detectSource(rawUrl: string): VideoSource {
  const u = parseUrl(rawUrl);
  if (!u) return "other";
  return sourceFromHost(normalizeHost(u.hostname));
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

function stripTrailingSlash(path: string): string {
  const p = path.replace(/\/+$/, "");
  return p === "" ? "/" : p;
}

/**
 * Chuẩn hóa URL video thành canonical URL ổn định.
 * - trim, lowercase hostname, bỏ www/m
 * - bỏ tracking params (utm_*, fbclid, gclid, spm, aff, ref, ...)
 * - YouTube: về dạng https://youtube.com/watch?v=<id>
 * - TikTok: bỏ query, giữ path video
 * - Facebook: bỏ tracking query, giữ path/canonical (giữ v / story_fbid nếu có)
 * - Khác: bỏ tracking params, sort query còn lại
 */
export function normalizeVideoUrl(rawUrl: string): string {
  const u = parseUrl(rawUrl);
  if (!u) return (rawUrl ?? "").trim().toLowerCase();

  const host = normalizeHost(u.hostname);
  const source = sourceFromHost(host);

  if (source === "youtube") {
    const id = extractYouTubeId(u, host);
    if (id) return `https://youtube.com/watch?v=${id}`;
    // không lấy được id -> rơi xuống xử lý generic phía dưới
  }

  if (source === "tiktok") {
    return `https://tiktok.com${stripTrailingSlash(u.pathname)}`;
  }

  if (source === "facebook") {
    const path = stripTrailingSlash(u.pathname);
    const kept = new URLSearchParams();
    const v = u.searchParams.get("v");
    const storyFbid = u.searchParams.get("story_fbid");
    const id = u.searchParams.get("id");
    if (v) kept.set("v", v);
    if (storyFbid) kept.set("story_fbid", storyFbid);
    if (id && storyFbid) kept.set("id", id);
    const qs = kept.toString();
    return `https://facebook.com${path}${qs ? `?${qs}` : ""}`;
  }

  // generic / other
  const entries = Array.from(u.searchParams.entries())
    .filter(([k]) => !isTrackingParam(k))
    .sort((a, b) => a[0].localeCompare(b[0]));
  const params = new URLSearchParams();
  for (const [k, val] of entries) params.append(k, val);
  const qs = params.toString();
  return `https://${host}${stripTrailingSlash(u.pathname)}${qs ? `?${qs}` : ""}`;
}
