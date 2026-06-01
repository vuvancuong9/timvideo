import { describe, expect, it } from "vitest";
import {
  capConfidence,
  parseConfidenceRule,
  DEFAULT_CONFIDENCE_RULE,
} from "@/lib/video-review/confidence-config";

describe("capConfidence (mặc định = capConfidenceWhenNoFile cũ)", () => {
  const def = DEFAULT_CONFIDENCE_RULE;

  it("không file: high -> medium, medium/low giữ nguyên", () => {
    expect(capConfidence("high", false, def)).toBe("medium");
    expect(capConfidence("medium", false, def)).toBe("medium");
    expect(capConfidence("low", false, def)).toBe("low");
  });

  it("có file: giữ nguyên mọi mức (kể cả high)", () => {
    expect(capConfidence("high", true, def)).toBe("high");
    expect(capConfidence("medium", true, def)).toBe("medium");
    expect(capConfidence("low", true, def)).toBe("low");
  });
});

describe("capConfidence (cấu hình)", () => {
  it("no_file_max='low' -> không file thì medium/high đều hạ về low", () => {
    const rule = { ...DEFAULT_CONFIDENCE_RULE, no_file_max: "low" as const };
    expect(capConfidence("high", false, rule)).toBe("low");
    expect(capConfidence("medium", false, rule)).toBe("low");
    expect(capConfidence("low", false, rule)).toBe("low");
  });

  it("allow_high_with_file=false -> có file vẫn hạ high về no_file_max", () => {
    const rule = {
      ...DEFAULT_CONFIDENCE_RULE,
      allow_high_with_file: false,
      no_file_max: "medium" as const,
    };
    expect(capConfidence("high", true, rule)).toBe("medium");
    expect(capConfidence("medium", true, rule)).toBe("medium");
  });
});

describe("parseConfidenceRule", () => {
  it("rỗng/sai -> mặc định", () => {
    expect(parseConfidenceRule(null)).toEqual(DEFAULT_CONFIDENCE_RULE);
    expect(parseConfidenceRule("x")).toEqual(DEFAULT_CONFIDENCE_RULE);
  });

  it("chỉ nhận no_file_max low|medium", () => {
    expect(parseConfidenceRule({ no_file_max: "high" }).no_file_max).toBe(
      "medium",
    );
    expect(parseConfidenceRule({ no_file_max: "low" }).no_file_max).toBe("low");
  });

  it("notes_vi: bỏ dòng rỗng, ép chuỗi, cap số dòng", () => {
    const out = parseConfidenceRule({
      notes_vi: ["  a  ", "", "b", 123],
    });
    expect(out.notes_vi).toEqual(["a", "b", "123"]);
  });

  it("allow_high_with_file chỉ nhận boolean", () => {
    expect(parseConfidenceRule({ allow_high_with_file: false }).allow_high_with_file).toBe(false);
    expect(
      parseConfidenceRule({ allow_high_with_file: "yes" }).allow_high_with_file,
    ).toBe(true); // giữ mặc định
  });
});
