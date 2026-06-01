import { describe, expect, it } from "vitest";
import {
  parseRiskGroups,
  DEFAULT_RISK_GROUPS,
} from "@/lib/video-review/policy-groups-config";

describe("parseRiskGroups", () => {
  it("không phải mảng / rỗng -> trả về mặc định", () => {
    expect(parseRiskGroups(null)).toEqual(DEFAULT_RISK_GROUPS);
    expect(parseRiskGroups([])).toEqual(DEFAULT_RISK_GROUPS);
    expect(parseRiskGroups("x")).toEqual(DEFAULT_RISK_GROUPS);
  });

  it("mặc định gốc đi qua parse không đổi (idempotent)", () => {
    expect(parseRiskGroups(DEFAULT_RISK_GROUPS)).toEqual(DEFAULT_RISK_GROUPS);
  });

  it("drop key không hợp lệ (hoa, dấu cách, bắt đầu bằng số)", () => {
    const out = parseRiskGroups([
      { key: "Bad Key", label_vi: "x" },
      { key: "1abc", label_vi: "y" },
      { key: "ok_key", label_vi: "Z" },
    ]);
    expect(out.map((g) => g.key)).toEqual(["ok_key"]);
  });

  it("auto lowercase + trim key", () => {
    const out = parseRiskGroups([{ key: "  MyRisk  ", label_vi: "A" }]);
    expect(out[0].key).toBe("myrisk");
  });

  it("drop key trùng từ khóa hệ thống (reserved)", () => {
    const out = parseRiskGroups([
      { key: "confidence", label_vi: "x" },
      { key: "final_policy_level", label_vi: "y" },
      { key: "good_one", label_vi: "Z" },
    ]);
    expect(out.map((g) => g.key)).toEqual(["good_one"]);
  });

  it("dedup theo key (first wins)", () => {
    const out = parseRiskGroups([
      { key: "dup", label_vi: "First" },
      { key: "dup", label_vi: "Second" },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].label_vi).toBe("First");
  });

  it("toàn bộ key xấu -> fallback mặc định (không lưu set rỗng)", () => {
    const out = parseRiskGroups([{ key: "BAD KEY", label_vi: "x" }]);
    expect(out).toEqual(DEFAULT_RISK_GROUPS);
  });

  it("cap tối đa 20 nhóm", () => {
    const many = Array.from({ length: 30 }, (_, i) => ({
      key: `risk_${i}`,
      label_vi: `R${i}`,
    }));
    expect(parseRiskGroups(many)).toHaveLength(20);
  });

  it("label_vi rỗng -> fallback nhãn mặc định nếu key trùng nhóm gốc", () => {
    const out = parseRiskGroups([
      { key: "ip_trademark_risk", label_vi: "" },
    ]);
    expect(out[0].label_vi.length).toBeGreaterThan(0);
  });

  it("chuẩn hóa category/critical_blocks/enabled với giá trị mặc định", () => {
    const out = parseRiskGroups([{ key: "abc_risk", label_vi: "A" }]);
    expect(out[0].category).toBe("policy");
    expect(out[0].critical_blocks).toBe(false);
    expect(out[0].enabled).toBe(true);
    const out2 = parseRiskGroups([
      {
        key: "cr_risk",
        label_vi: "B",
        category: "copyright",
        critical_blocks: true,
        enabled: false,
      },
    ]);
    expect(out2[0].category).toBe("copyright");
    expect(out2[0].critical_blocks).toBe(true);
    expect(out2[0].enabled).toBe(false);
  });
});
