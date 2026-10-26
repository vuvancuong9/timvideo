/**
 * Resolve link rút gọn -> URL cuối (server-only: cần fetch + theo redirect).
 *
 * Chỉ resolve các host rút gọn ĐÃ BIẾT của nền tảng video (chống SSRF: không
 * đi theo redirect của URL tùy ý). Có timeout + luôn fallback về URL gốc khi
 * lỗi/timeout/đi tới host lạ, nên không bao giờ làm hỏng luồng gửi video.
 */

import { isDeadVideoUrl } from "@/lib/video-intake/normalize-url";

/** Các host rút gọn được phép resolve. */
const SHORT_LINK_HOSTS = new Set([
  "vt.tiktok.com",
  "vm.tiktok.com",
  "fb.watch",
]);

/** Đích hợp lệ sau khi resolve (để không nhận URL đi lạc sang host lạ). */
const ALLOWED_FINAL_HOSTS = ["tiktok.com", "facebook.com", "fb.com"];

const TIMEOUT_MS = 4000;

function hostOf(raw: string): string | null {
  try {
    const s = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    return new URL(s).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

function isAllowedFinal(host: string): boolean {
  const h = host.replace(/^www\./, "");
  return ALLOWED_FINAL_HOSTS.some((d) => h === d || h.endsWith(`.${d}`));
}

/** Có phải link rút gọn / link share cần resolve không. */
export function isShortLink(rawUrl: string): boolean {
  let u: URL;
  try {
    const s = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
    u = new URL(s);
  } catch {
    return false;
  }
  const host = u.hostname.toLowerCase().replace(/^www\./, "");
  if (SHORT_LINK_HOSTS.has(host)) return true;
  // Link share Facebook: facebook.com/share/{v,r,p}/<token> -> /reel|watch thật.
  const fb =
    host === "facebook.com" || host.endsWith(".facebook.com") || host === "fb.com";
  return fb && /^\/share\//i.test(u.pathname);
}

const MAX_HOPS = 5;

/**
 * Theo redirect của link rút gọn để lấy URL đầy đủ. Trả về URL gốc nếu không
 * phải link rút gọn, hoặc khi resolve thất bại/timeout/đi tới host lạ.
 *
 * Chỉ đọc header Location từng bước (redirect: "manual") và dừng ngay khi tới
 * URL đầy đủ: theo redirect tự động thì phải chờ tải cả trang TikTok/Facebook
 * (~0,6-0,9s so với ~0,1s). Mỗi bước chỉ đi tiếp tới host đã biết.
 */
export async function resolveShortLink(rawUrl: string): Promise<string> {
  if (!isShortLink(rawUrl)) return rawUrl;

  const start = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    let cur = start;
    for (let hop = 0; hop < MAX_HOPS && isShortLink(cur); hop++) {
      const res = await fetch(cur, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          // Một số CDN trả 200 cho UA lạ; giả lập trình duyệt để nhận redirect.
          "user-agent":
            "Mozilla/5.0 (compatible; timvideo-dedup/1.0; +https://timvideo.vercel.app)",
        },
      });
      // Không đọc body (chỉ cần header) -> hủy stream cho nhẹ.
      try {
        await res.body?.cancel();
      } catch {
        // ignore
      }
      const rawLoc = res.headers.get("location");
      if (res.status < 300 || res.status >= 400 || !rawLoc) break;
      // Header HTTP tới dạng latin1; byte UTF-8 chưa percent-encode (vd tên
      // @user có dấu) phải giải lại, như redirect:"follow" vẫn làm.
      const loc = /[\u0080-ÿ]/.test(rawLoc)
        ? Buffer.from(rawLoc, "latin1").toString("utf8")
        : rawLoc;
      const next = new URL(loc, cur).toString();
      const nextHost = hostOf(next);
      if (!nextHost || !(isAllowedFinal(nextHost) || SHORT_LINK_HOSTS.has(nextHost))) {
        return rawUrl;
      }
      cur = next;
    }
    if (cur === start || isShortLink(cur) || isDeadVideoUrl(cur)) return rawUrl;
    const finalHost = hostOf(cur);
    return finalHost && isAllowedFinal(finalHost) ? cur : rawUrl;
  } catch {
    return rawUrl; // timeout / lỗi mạng -> không chặn luồng
  } finally {
    clearTimeout(timer);
  }
}
