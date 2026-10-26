import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveShortLink } from "@/lib/video-intake/resolve-url";

type Hop = { status: number; location?: string };

/** fetch giả: trả lần lượt theo bảng url -> phản hồi; ghi lại các lần gọi. */
function stubFetch(table: Record<string, Hop>) {
  const calls: { url: string; redirect?: string }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, redirect: init?.redirect });
      const hop = table[url];
      if (!hop) throw new Error(`unexpected fetch ${url}`);
      return new Response(null, {
        status: hop.status,
        headers: hop.location ? { location: hop.location } : {},
      });
    }),
  );
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("resolveShortLink", () => {
  it("vt.tiktok.com → đọc Location 1 bước, không tải trang TikTok", async () => {
    const calls = stubFetch({
      "https://vt.tiktok.com/ZSgxbS5Cr/": {
        status: 301,
        location: "https://www.tiktok.com/@andammesocc/video/7555140173843975445?_r=1",
      },
    });
    await expect(resolveShortLink("https://vt.tiktok.com/ZSgxbS5Cr/")).resolves.toBe(
      "https://www.tiktok.com/@andammesocc/video/7555140173843975445?_r=1",
    );
    expect(calls).toHaveLength(1);
    expect(calls[0].redirect).toBe("manual");
  });

  it("link share Facebook qua nhiều bước redirect", async () => {
    stubFetch({
      "https://www.facebook.com/share/v/abc/": { status: 302, location: "/share/v/abc2/" },
      "https://www.facebook.com/share/v/abc2/": {
        status: 302,
        location: "https://www.facebook.com/reel/123456789",
      },
    });
    await expect(resolveShortLink("https://www.facebook.com/share/v/abc/")).resolves.toBe(
      "https://www.facebook.com/reel/123456789",
    );
  });

  it("redirect sang host lạ → trả URL gốc, không đi tiếp (chống SSRF)", async () => {
    const calls = stubFetch({
      "https://vt.tiktok.com/x/": { status: 302, location: "http://169.254.169.254/latest" },
    });
    await expect(resolveShortLink("https://vt.tiktok.com/x/")).resolves.toBe("https://vt.tiktok.com/x/");
    expect(calls).toHaveLength(1);
  });

  it("không redirect / lỗi mạng → trả URL gốc", async () => {
    stubFetch({ "https://vt.tiktok.com/y/": { status: 200 } });
    await expect(resolveShortLink("https://vt.tiktok.com/y/")).resolves.toBe("https://vt.tiktok.com/y/");
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("ECONNRESET"); }));
    await expect(resolveShortLink("https://vt.tiktok.com/z/")).resolves.toBe("https://vt.tiktok.com/z/");
  });

  it("link hỏng/hết hạn redirect về /@/video/0 → giữ URL gốc (không thành khoá trùng chung)", async () => {
    stubFetch({
      "https://vt.tiktok.com/ZSbhVM8mW/po": {
        status: 302,
        location: "https://www.tiktok.com/@/video/0?_r=1&share_item_id=0",
      },
    });
    await expect(resolveShortLink("https://vt.tiktok.com/ZSbhVM8mW/po")).resolves.toBe(
      "https://vt.tiktok.com/ZSbhVM8mW/po",
    );
  });

  it("Location chứa byte UTF-8 chưa encode → giải đúng", async () => {
    const utf8 = "https://www.tiktok.com/@bé.na/video/7555140173843975445";
    stubFetch({
      "https://vt.tiktok.com/u/": { status: 301, location: Buffer.from(utf8, "utf8").toString("latin1") },
    });
    const out = await resolveShortLink("https://vt.tiktok.com/u/");
    expect(decodeURIComponent(out)).toBe(utf8);
  });

  it("URL đầy đủ thì không gọi mạng", async () => {
    const calls = stubFetch({});
    const u = "https://www.tiktok.com/@a/video/123";
    await expect(resolveShortLink(u)).resolves.toBe(u);
    expect(calls).toHaveLength(0);
  });
});
