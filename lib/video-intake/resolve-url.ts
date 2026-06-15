/**
 * Resolve link rút gọn -> URL cuối (server-only: cần fetch + theo redirect).
 *
 * Chỉ resolve các host rút gọn ĐÃ BIẾT của nền tảng video (chống SSRF: không
 * đi theo redirect của URL tùy ý). Có timeout + luôn fallback về URL gốc khi
 * lỗi/timeout/đi tới host lạ, nên không bao giờ làm hỏng luồng gửi video.
 */

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

/** Có phải link rút gọn cần resolve không. */
export function isShortLink(rawUrl: string): boolean {
  const h = hostOf(rawUrl);
  return h ? SHORT_LINK_HOSTS.has(h) : false;
}

/**
 * Theo redirect của link rút gọn để lấy URL đầy đủ. Trả về URL gốc nếu không
 * phải link rút gọn, hoặc khi resolve thất bại/timeout/đi tới host lạ.
 */
export async function resolveShortLink(rawUrl: string): Promise<string> {
  if (!isShortLink(rawUrl)) return rawUrl;

  const start = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(start, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        // Một số CDN trả 200 cho UA lạ; giả lập trình duyệt để nhận redirect.
        "user-agent":
          "Mozilla/5.0 (compatible; timvideo-dedup/1.0; +https://timvideo.vercel.app)",
      },
    });
    // Không đọc body (chỉ cần URL cuối) -> hủy stream cho nhẹ.
    try {
      await res.body?.cancel();
    } catch {
      // ignore
    }
    const finalUrl = res.url || start;
    const finalHost = hostOf(finalUrl);
    return finalHost && isAllowedFinal(finalHost) ? finalUrl : rawUrl;
  } catch {
    return rawUrl; // timeout / lỗi mạng -> không chặn luồng
  } finally {
    clearTimeout(timer);
  }
}
