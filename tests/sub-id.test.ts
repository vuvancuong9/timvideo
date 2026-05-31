import { describe, expect, it } from "vitest";
import {
  accountSlug,
  vnDateDDMM,
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

describe("buildSubId (DDMM + account + STT, không dấu)", () => {
  it("ghép đúng định dạng ví dụ 31/05", () => {
    expect(buildSubId("3105", "cuongbghvtc", 1)).toBe("3105cuongbghvtc001");
    expect(buildSubId("3105", "cuongbghvtc", 12)).toBe("3105cuongbghvtc012");
    expect(buildSubId("3105", "cuongbghvtc", 7)).toBe("3105cuongbghvtc007");
  });
});

describe("vnDateDDMM (giờ VN +7)", () => {
  it("05:00Z 31/05 -> 3105", () => {
    expect(vnDateDDMM(new Date("2026-05-31T05:00:00Z"))).toBe("3105");
  });
  it("20:00Z 31/05 -> sang 01/06 theo giờ VN -> 0106", () => {
    expect(vnDateDDMM(new Date("2026-05-31T20:00:00Z"))).toBe("0106");
  });
  it("mùng 1 tháng 1 -> 0101", () => {
    expect(vnDateDDMM(new Date("2026-01-01T03:00:00Z"))).toBe("0101");
  });
});
