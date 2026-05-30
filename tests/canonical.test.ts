import { describe, expect, it } from "vitest";
import { detectSource, normalizeVideoUrl } from "@/lib/url/canonical";
import { canonicalizeVideo } from "@/lib/url/hash";

describe("detectSource", () => {
  it("nhận diện đúng nguồn video", () => {
    expect(detectSource("https://www.youtube.com/watch?v=abc")).toBe("youtube");
    expect(detectSource("https://youtu.be/abc")).toBe("youtube");
    expect(detectSource("https://m.tiktok.com/@u/video/1")).toBe("tiktok");
    expect(detectSource("https://www.facebook.com/watch?v=1")).toBe("facebook");
    expect(detectSource("https://fb.watch/abcd/")).toBe("facebook");
    expect(detectSource("https://vimeo.com/123")).toBe("other");
  });
});

describe("normalizeVideoUrl - YouTube", () => {
  const expected = "https://youtube.com/watch?v=abc123";
  it("youtube.com/watch?v + tracking", () => {
    expect(
      normalizeVideoUrl(
        "https://www.youtube.com/watch?v=abc123&utm_source=x&feature=share",
      ),
    ).toBe(expected);
  });
  it("youtu.be + si", () => {
    expect(normalizeVideoUrl("https://youtu.be/abc123?si=token")).toBe(expected);
  });
  it("m.youtube.com", () => {
    expect(normalizeVideoUrl("https://m.youtube.com/watch?v=abc123")).toBe(
      expected,
    );
  });
  it("youtube shorts", () => {
    expect(normalizeVideoUrl("https://www.youtube.com/shorts/abc123")).toBe(
      expected,
    );
  });
});

describe("normalizeVideoUrl - TikTok", () => {
  const expected = "https://tiktok.com/@user/video/12345";
  it("bỏ query string", () => {
    expect(
      normalizeVideoUrl(
        "https://www.tiktok.com/@user/video/12345?is_from_webapp=1&sender_device=pc",
      ),
    ).toBe(expected);
  });
  it("m.tiktok.com", () => {
    expect(normalizeVideoUrl("https://m.tiktok.com/@user/video/12345")).toBe(
      expected,
    );
  });
});

describe("normalizeVideoUrl - Facebook", () => {
  const expected = "https://facebook.com/watch?v=12345";
  it("bỏ tracking, giữ v", () => {
    expect(
      normalizeVideoUrl("https://www.facebook.com/watch?v=12345&ref=share"),
    ).toBe(expected);
  });
  it("trailing slash", () => {
    expect(
      normalizeVideoUrl("https://facebook.com/watch/?v=12345&mibextid=abc"),
    ).toBe(expected);
  });
});

describe("normalizeVideoUrl - generic", () => {
  it("lowercase host, bỏ tracking, giữ param còn lại", () => {
    expect(
      normalizeVideoUrl("HTTP://WWW.Example.com/Video/?id=5&utm_medium=x"),
    ).toBe("https://example.com/Video?id=5");
  });
  it("trim khoảng trắng", () => {
    expect(normalizeVideoUrl("  https://example.com/a  ")).toBe(
      "https://example.com/a",
    );
  });
});

describe("canonicalizeVideo - chống trùng (acceptance #8 & #9)", () => {
  it("các biến thể YouTube có tracking cho cùng 1 hash", () => {
    const a = canonicalizeVideo(
      "https://www.youtube.com/watch?v=abc123&utm_source=x",
    );
    const b = canonicalizeVideo("https://youtu.be/abc123?si=token");
    expect(a.hash).toBe(b.hash);
    expect(a.canonicalUrl).toBe("https://youtube.com/watch?v=abc123");
  });

  it("biến thể TikTok có tracking cho cùng 1 hash", () => {
    const a = canonicalizeVideo(
      "https://www.tiktok.com/@user/video/12345?is_from_webapp=1",
    );
    const b = canonicalizeVideo("https://m.tiktok.com/@user/video/12345");
    expect(a.hash).toBe(b.hash);
  });

  it("biến thể Facebook có tracking cho cùng 1 hash", () => {
    const a = canonicalizeVideo("https://www.facebook.com/watch?v=12345&ref=x");
    const b = canonicalizeVideo("https://facebook.com/watch/?v=12345");
    expect(a.hash).toBe(b.hash);
  });

  it("video khác nhau cho hash khác nhau", () => {
    const a = canonicalizeVideo("https://youtu.be/aaa");
    const b = canonicalizeVideo("https://youtu.be/bbb");
    expect(a.hash).not.toBe(b.hash);
  });
});
