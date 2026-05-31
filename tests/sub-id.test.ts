import { describe, expect, it } from "vitest";
import {
  accountSlug,
  vnDateCompact,
  buildSubId,
} from "@/lib/video-intake/sub-id";

describe("accountSlug", () => {
  it("lấy phần trước @ của email", () => {
    expect(accountSlug("cuongbghvtc@gmail.com", null)).toBe("cuongbghvtc");
  });
  it("bỏ dấu tiếng Việt từ full_name khi không có email", () => {
    expect(accountSlug(null, "Nguyễn Văn Đức")).toBe("nguyenvanduc");
  });
  it("fallback 'user' khi rỗng", () => {
    expect(accountSlug("", "")).toBe("user");
  });
  it("loại ký tự đặc biệt", () => {
    expect(accountSlug("le.thi-hoa+sale@x.com", null)).toBe("lethihoasale");
  });
});

describe("buildSubId", () => {
  it("ghép đúng định dạng, pad 3 chữ số", () => {
    expect(buildSubId("20260531", "cuong", 1)).toBe("20260531-cuong-001");
    expect(buildSubId("20260531", "cuong", 12)).toBe("20260531-cuong-012");
    expect(buildSubId("20260531", "cuong", 7)).toBe("20260531-cuong-007");
  });
});

describe("vnDateCompact (giờ VN +7)", () => {
  it("12:00Z 31/05 -> 20260531", () => {
    expect(vnDateCompact(new Date("2026-05-31T05:00:00Z"))).toBe("20260531");
  });
  it("20:00Z 31/05 -> sang 01/06 theo giờ VN", () => {
    expect(vnDateCompact(new Date("2026-05-31T20:00:00Z"))).toBe("20260601");
  });
});
