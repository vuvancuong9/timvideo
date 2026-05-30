import { describe, expect, it } from "vitest";
import {
  canAccessSection,
  canAssignAffiliate,
  canEditShortLink,
  canUpdateVideoFields,
  canUploadDrive,
  canViewAllVideos,
  canViewVideo,
  isReadOnly,
} from "@/lib/permissions";

describe("Acceptance #1 — staff chỉ xem video của chính mình", () => {
  it("staff A KHÔNG xem được video của staff B", () => {
    expect(canViewVideo("staff", "A", { created_by: "B" })).toBe(false);
  });
  it("staff A xem được video của chính mình", () => {
    expect(canViewVideo("staff", "A", { created_by: "A" })).toBe(true);
  });
  it("accountant/aggregator/admin xem được tất cả", () => {
    expect(canViewVideo("accountant", "X", { created_by: "B" })).toBe(true);
    expect(canViewVideo("aggregator", "X", { created_by: "B" })).toBe(true);
    expect(canViewVideo("admin", "X", { created_by: "B" })).toBe(true);
  });
});

describe("Acceptance #2 — staff không sửa assigned_affiliate_account_id", () => {
  it("canUpdateVideoFields=false", () => {
    expect(canUpdateVideoFields("staff", ["assigned_affiliate_account_id"])).toBe(
      false,
    );
  });
  it("canAssignAffiliate=false", () => {
    expect(canAssignAffiliate("staff")).toBe(false);
  });
});

describe("Acceptance #3 — staff không sửa short_link", () => {
  it("canUpdateVideoFields=false", () => {
    expect(canUpdateVideoFields("staff", ["short_link"])).toBe(false);
  });
  it("canEditShortLink=false", () => {
    expect(canEditShortLink("staff")).toBe(false);
  });
});

describe("Acceptance #4 — accountant read-only, xem tất cả", () => {
  it("isReadOnly=true", () => {
    expect(isReadOnly("accountant")).toBe(true);
  });
  it("không sửa được trường nào", () => {
    expect(canUpdateVideoFields("accountant", ["status"])).toBe(false);
    expect(canUpdateVideoFields("accountant", ["aggregate_note"])).toBe(false);
    expect(canAssignAffiliate("accountant")).toBe(false);
    expect(canEditShortLink("accountant")).toBe(false);
    expect(canUploadDrive("accountant")).toBe(false);
  });
  it("nhưng xem được toàn bộ video", () => {
    expect(canViewAllVideos("accountant")).toBe(true);
  });
});

describe("Acceptance #5 — aggregator phân affiliate", () => {
  it("canAssignAffiliate=true", () => {
    expect(canAssignAffiliate("aggregator")).toBe(true);
  });
  it("được sửa các trường tổng hợp", () => {
    expect(
      canUpdateVideoFields("aggregator", [
        "assigned_affiliate_account_id",
        "status",
        "aggregate_note",
      ]),
    ).toBe(true);
  });
});

describe("Acceptance #6 — aggregator KHÔNG sửa short_link", () => {
  it("canEditShortLink=false", () => {
    expect(canEditShortLink("aggregator")).toBe(false);
  });
  it("canUpdateVideoFields short_link=false", () => {
    expect(canUpdateVideoFields("aggregator", ["short_link"])).toBe(false);
  });
  it("kèm short_link trong tập trường -> vẫn false", () => {
    expect(canUpdateVideoFields("aggregator", ["status", "short_link"])).toBe(
      false,
    );
  });
});

describe("Acceptance #7 — admin sửa được short_link", () => {
  it("canEditShortLink=true", () => {
    expect(canEditShortLink("admin")).toBe(true);
  });
  it("admin sửa được mọi trường", () => {
    expect(canUpdateVideoFields("admin", ["short_link", "status"])).toBe(true);
    expect(canAssignAffiliate("admin")).toBe(true);
    expect(canUploadDrive("admin")).toBe(true);
  });
});

describe("Truy cập khu vực theo role", () => {
  it("staff chỉ vào khu vực nhân viên", () => {
    expect(canAccessSection("staff", "staff")).toBe(true);
    expect(canAccessSection("staff", "accounting")).toBe(false);
    expect(canAccessSection("staff", "aggregate")).toBe(false);
    expect(canAccessSection("staff", "admin")).toBe(false);
  });
  it("accountant chỉ vào kế toán", () => {
    expect(canAccessSection("accountant", "accounting")).toBe(true);
    expect(canAccessSection("accountant", "admin")).toBe(false);
  });
  it("aggregator chỉ vào tổng hợp", () => {
    expect(canAccessSection("aggregator", "aggregate")).toBe(true);
    expect(canAccessSection("aggregator", "admin")).toBe(false);
  });
  it("admin vào được tất cả", () => {
    expect(canAccessSection("admin", "staff")).toBe(true);
    expect(canAccessSection("admin", "accounting")).toBe(true);
    expect(canAccessSection("admin", "aggregate")).toBe(true);
    expect(canAccessSection("admin", "admin")).toBe(true);
  });
});
