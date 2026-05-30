import { describe, expect, it } from "vitest";
import {
  detectVideoSource,
  canonicalizeVideoUrl,
} from "@/lib/video-intake/normalize-url";
import { canonicalizeForDedup } from "@/lib/video-intake/duplicate";

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
