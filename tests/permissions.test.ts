import { describe, expect, it } from "vitest";
import {
  canViewSubmission,
  canUpdateSubmissionField,
  type CurrentUser,
} from "@/lib/auth/role-guard";

function user(role: CurrentUser["role"], id = "u1"): CurrentUser {
  return {
    userId: id,
    email: `${id}@x.com`,
    role,
    profile: {
      id,
      email: `${id}@x.com`,
      full_name: null,
      role,
      is_active: true,
      created_at: "",
      updated_at: "",
    },
  };
}

describe("Acceptance #1 — staff chỉ xem video của chính mình", () => {
  it("staff A KHÔNG xem được video của staff B", () => {
    expect(
      canViewSubmission(user("staff", "A"), { created_by: "B" }),
    ).toBe(false);
  });
  it("staff A xem được video của chính mình", () => {
    expect(
      canViewSubmission(user("staff", "A"), { created_by: "A" }),
    ).toBe(true);
  });
  it("accountant/aggregator/admin xem được tất cả", () => {
    expect(canViewSubmission(user("accountant"), { created_by: "B" })).toBe(
      true,
    );
    expect(canViewSubmission(user("aggregator"), { created_by: "B" })).toBe(
      true,
    );
    expect(canViewSubmission(user("admin"), { created_by: "B" })).toBe(true);
  });
});

describe("Acceptance #2 — staff không sửa assigned_affiliate_account_id", () => {
  it("staff creator không sửa được", () => {
    expect(
      canUpdateSubmissionField(
        user("staff", "A"),
        "assigned_affiliate_account_id",
        { isCreator: true, isReviewed: false },
      ),
    ).toBe(false);
  });
});

describe("Acceptance #3 — staff không sửa short_link", () => {
  it("staff creator không sửa short_link", () => {
    expect(
      canUpdateSubmissionField(user("staff", "A"), "short_link", {
        isCreator: true,
        isReviewed: false,
      }),
    ).toBe(false);
  });
});

describe("Acceptance #4 — accountant read-only", () => {
  it("không sửa được trường nào", () => {
    for (const f of [
      "status",
      "aggregate_note",
      "short_link",
      "assigned_affiliate_account_id",
      "staff_note",
      "product_price",
    ]) {
      expect(canUpdateSubmissionField(user("accountant"), f)).toBe(false);
    }
  });
});

describe("Acceptance #5 — aggregator assign affiliate được", () => {
  it("sửa được assigned + aggregate_note + status", () => {
    expect(
      canUpdateSubmissionField(
        user("aggregator"),
        "assigned_affiliate_account_id",
      ),
    ).toBe(true);
    expect(canUpdateSubmissionField(user("aggregator"), "aggregate_note")).toBe(
      true,
    );
    expect(canUpdateSubmissionField(user("aggregator"), "status")).toBe(true);
  });
});

describe("Acceptance #6 — aggregator KHÔNG sửa short_link", () => {
  it("short_link & admin_note bị chặn", () => {
    expect(canUpdateSubmissionField(user("aggregator"), "short_link")).toBe(
      false,
    );
    expect(canUpdateSubmissionField(user("aggregator"), "admin_note")).toBe(
      false,
    );
    // không sửa được field gốc của nhân viên
    expect(canUpdateSubmissionField(user("aggregator"), "product_price")).toBe(
      false,
    );
  });
});

describe("Acceptance #7 — admin sửa được short_link", () => {
  it("admin toàn quyền field", () => {
    expect(canUpdateSubmissionField(user("admin"), "short_link")).toBe(true);
    expect(canUpdateSubmissionField(user("admin"), "admin_note")).toBe(true);
    expect(canUpdateSubmissionField(user("admin"), "product_price")).toBe(true);
  });
});

describe("staff field rules thêm", () => {
  it("staff creator sửa được staff_note khi chưa reviewed", () => {
    expect(
      canUpdateSubmissionField(user("staff", "A"), "staff_note", {
        isCreator: true,
        isReviewed: false,
      }),
    ).toBe(true);
  });
  it("staff creator KHÔNG sửa được sau khi reviewed", () => {
    expect(
      canUpdateSubmissionField(user("staff", "A"), "staff_note", {
        isCreator: true,
        isReviewed: true,
      }),
    ).toBe(false);
  });
  it("staff KHÔNG phải creator không sửa được", () => {
    expect(
      canUpdateSubmissionField(user("staff", "A"), "staff_note", {
        isCreator: false,
        isReviewed: false,
      }),
    ).toBe(false);
  });
});
