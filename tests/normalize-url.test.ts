import { describe, expect, it } from "vitest";
import {
  detectVideoSource,
  canonicalizeVideoUrl,
  videoExternalId,
} from "@/lib/video-intake/normalize-url";
import { canonicalizeForDedup } from "@/lib/video-intake/duplicate";
import { isShortLink } from "@/lib/video-intake/resolve-url";

describe("detectVideoSource", () => {
  it("nhận diện đúng nguồn", () => {
    expect(detectVideoSource("https://www.tiktok.com/@u/video/1")).toBe(
      "tiktok_url",
    );
    expect(detectVideoSource("https://youtu.be/abc")).toBe("youtube_url");
    expect(detectVideoSource("https://www.facebook.com/reel/1")).toBe(
      "facebook_url",
    );
    expect(detectVideoSource("https://vimeo.com/1")).toBe("other_url");
  });
});

describe("Acceptance #8 — TikTok URL có query params vẫn trùng", () => {
  it("bỏ query string", () => {
    const a = canonicalizeForDedup(
      "https://www.tiktok.com/@user/video/12345?is_from_webapp=1&sender_device=pc",
    );
    const b = canonicalizeForDedup("https://m.tiktok.com/@user/video/12345");
    expect(a.canonicalHash).toBe(b.canonicalHash);
    expect(a.canonicalUrl).toBe("https://www.tiktok.com/@user/video/12345");
  });
});

describe("Acceptance #9 — YouTube youtu.be và watch?v cùng hash", () => {
  it("các biến thể YouTube trùng nhau", () => {
    const watch = canonicalizeForDedup(
      "https://www.youtube.com/watch?v=abc123&utm_source=x&feature=share",
    );
    const short = canonicalizeForDedup("https://youtu.be/abc123?si=token");
    const mobile = canonicalizeForDedup(
      "https://m.youtube.com/watch?v=abc123",
    );
    const shorts = canonicalizeForDedup(
      "https://www.youtube.com/shorts/abc123",
    );
    expect(watch.canonicalHash).toBe(short.canonicalHash);
    expect(watch.canonicalHash).toBe(mobile.canonicalHash);
    expect(watch.canonicalHash).toBe(shorts.canonicalHash);
    expect(watch.canonicalUrl).toBe("https://www.youtube.com/watch?v=abc123");
  });
});

describe("Facebook + tracking", () => {
  it("bỏ fbclid/mibextid, giữ v", () => {
    const a = canonicalizeForDedup(
      "https://www.facebook.com/watch?v=12345&fbclid=xx&mibextid=yy",
    );
    const b = canonicalizeForDedup("https://facebook.com/watch/?v=12345");
    expect(a.canonicalHash).toBe(b.canonicalHash);
  });
});

describe("canonicalizeVideoUrl - generic", () => {
  it("lowercase host, bỏ tracking, giữ param còn lại", () => {
    expect(
      canonicalizeVideoUrl("HTTP://WWW.Example.com/Video/?id=5&utm_medium=x"),
    ).toBe("https://example.com/Video?id=5");
  });
  it("trim khoảng trắng", () => {
    expect(canonicalizeVideoUrl("  https://example.com/a  ")).toBe(
      "https://example.com/a",
    );
  });
});

describe("video khác nhau -> hash khác", () => {
  it("khác id", () => {
    const a = canonicalizeForDedup("https://youtu.be/aaa");
    const b = canonicalizeForDedup("https://youtu.be/bbb");
    expect(a.canonicalHash).not.toBe(b.canonicalHash);
  });
});

describe("videoExternalId — khóa ID video gốc (Bậc 1)", () => {
  it("TikTok: trích ID số bất kể @username / query / mobile", () => {
    const id = "tiktok:7555696123738901780";
    expect(
      videoExternalId(
        "https://www.tiktok.com/@_damthanhan_/video/7555696123738901780?_r=1&_t=ZS-9",
      ),
    ).toBe(id);
    expect(
      videoExternalId("https://m.tiktok.com/@nguoikhac/video/7555696123738901780"),
    ).toBe(id);
    // Cùng ID dù khác @username -> cùng khóa (lỗ hổng cũ của dedup theo path).
    expect(videoExternalId("https://www.tiktok.com/video/7555696123738901780")).toBe(
      id,
    );
  });

  it("Facebook: reel / watch?v / videos -> facebook:id", () => {
    expect(videoExternalId("https://www.facebook.com/reel/1002084012178097")).toBe(
      "facebook:1002084012178097",
    );
    expect(
      videoExternalId("https://www.facebook.com/watch?v=998877&fbclid=x"),
    ).toBe("facebook:998877");
    expect(
      videoExternalId("https://www.facebook.com/SomePage/videos/123456789"),
    ).toBe("facebook:123456789");
  });

  it("YouTube: watch?v / youtu.be / shorts cùng ID", () => {
    expect(videoExternalId("https://www.youtube.com/watch?v=abc123&feature=x")).toBe(
      "youtube:abc123",
    );
    expect(videoExternalId("https://youtu.be/abc123?si=token")).toBe(
      "youtube:abc123",
    );
    expect(videoExternalId("https://www.youtube.com/shorts/abc123")).toBe(
      "youtube:abc123",
    );
  });

  it("URL không trích được ID -> null (dùng canonical hash)", () => {
    expect(videoExternalId("https://vt.tiktok.com/ZSQd3eq2w/")).toBeNull();
    expect(videoExternalId("https://vimeo.com/12345")).toBeNull();
    expect(videoExternalId("https://www.tiktok.com/@someuser")).toBeNull();
    expect(videoExternalId("không-phải-url")).toBeNull();
  });

  it("canonicalizeForDedup kèm externalId cho video nền tảng", () => {
    const c = canonicalizeForDedup(
      "https://www.tiktok.com/@u/video/999?_t=abc",
    );
    expect(c.externalId).toBe("tiktok:999");
  });

  it("TikTok thiếu @username (@/video/id) vẫn trích được", () => {
    expect(
      videoExternalId("https://www.tiktok.com/@/video/7576871688449658128"),
    ).toBe("tiktok:7576871688449658128");
  });

  it("Facebook reel nằm nhầm ở cột TikTok vẫn ra facebook:id", () => {
    expect(videoExternalId("https://www.facebook.com/reel/831756516670088")).toBe(
      "facebook:831756516670088",
    );
  });
});

describe("isShortLink — link cần resolve ở server", () => {
  it("nhận link rút gọn TikTok + fb.watch", () => {
    expect(isShortLink("https://vt.tiktok.com/ZSQd3eq2w/")).toBe(true);
    expect(isShortLink("https://vm.tiktok.com/abc/")).toBe(true);
    expect(isShortLink("https://fb.watch/xyz/")).toBe(true);
  });
  it("nhận link share Facebook (/share/v|r/...)", () => {
    expect(isShortLink("https://www.facebook.com/share/v/192dGXxhha/")).toBe(true);
    expect(isShortLink("https://www.facebook.com/share/r/1BVDfeYJtU/")).toBe(true);
    expect(isShortLink("https://web.facebook.com/share/v/abc/")).toBe(true);
  });
  it("KHÔNG coi link đầy đủ là link rút gọn", () => {
    expect(isShortLink("https://www.tiktok.com/@u/video/123")).toBe(false);
    expect(isShortLink("https://www.facebook.com/reel/123")).toBe(false);
    expect(isShortLink("https://youtu.be/abc")).toBe(false);
  });
});
