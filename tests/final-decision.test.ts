import { describe, expect, it } from "vitest";
import {
  computeCreativeScore,
  decideFinalAction,
} from "@/lib/video-review/final-decision";
import type { CreativeScoreModelResult } from "@/types/videoReview";

const baseModel: CreativeScoreModelResult = {
  hook_score: 80,
  product_clarity_score: 80,
  demo_score: 80,
  trust_score: 80,
  affiliate_fit_score: 80,
  remake_score: 80,
  reasons: [],
  suggested_titles: [],
  suggested_scripts: [],
  suggested_edits: [],
  confidence: "high",
};

describe("computeCreativeScore", () => {
  it("trọng số đúng (tất cả 80 -> 80)", () => {
    expect(computeCreativeScore(baseModel)).toBe(80);
  });
  it("hook cao kéo điểm lên theo trọng số 0.25", () => {
    const m = { ...baseModel, hook_score: 100, demo_score: 0, trust_score: 0 };
    // 100*.25 + 80*.20 + 0 + 0 + 80*.10 + 80*.10 = 25+16+8+8 = 57
    expect(computeCreativeScore(m)).toBe(57);
  });
});

describe("Acceptance #11 — policy_safety < 50 -> REJECT_POLICY_RISK", () => {
  it("điểm policy thấp", () => {
    const r = decideFinalAction({
      creative_score: 90,
      policy_safety_score: 40,
      copyright_safety_score: 90,
      final_policy_level: "high",
      ip_trademark_risk: "low",
    });
    expect(r.final_action).toBe("REJECT_POLICY_RISK");
  });
  it("final_policy_level critical cũng reject policy", () => {
    const r = decideFinalAction({
      creative_score: 90,
      policy_safety_score: 90,
      copyright_safety_score: 90,
      final_policy_level: "critical",
      ip_trademark_risk: "low",
    });
    expect(r.final_action).toBe("REJECT_POLICY_RISK");
  });
});

describe("Acceptance #12 — copyright_safety < 50 -> REJECT_COPYRIGHT_RISK", () => {
  it("điểm copyright thấp (policy ok)", () => {
    const r = decideFinalAction({
      creative_score: 90,
      policy_safety_score: 90,
      copyright_safety_score: 40,
      final_policy_level: "low",
      ip_trademark_risk: "low",
    });
    expect(r.final_action).toBe("REJECT_COPYRIGHT_RISK");
  });
  it("ip_trademark critical -> reject copyright", () => {
    const r = decideFinalAction({
      creative_score: 90,
      policy_safety_score: 90,
      copyright_safety_score: 90,
      final_policy_level: "low",
      ip_trademark_risk: "critical",
    });
    expect(r.final_action).toBe("REJECT_COPYRIGHT_RISK");
  });
});

describe("Acceptance #13 — creative thấp -> LOW_PERFORMANCE", () => {
  it("an toàn nhưng creative kém", () => {
    const r = decideFinalAction({
      creative_score: 50,
      policy_safety_score: 90,
      copyright_safety_score: 90,
      final_policy_level: "low",
      ip_trademark_risk: "low",
    });
    expect(r.final_action).toBe("LOW_PERFORMANCE");
  });
});

describe("APPROVE_RUN_ADS & NEED_EDIT & REMAKE_SAFE", () => {
  it("điểm cao mọi mặt -> APPROVE_RUN_ADS", () => {
    const r = decideFinalAction({
      creative_score: 85,
      policy_safety_score: 85,
      copyright_safety_score: 80,
      final_policy_level: "low",
      ip_trademark_risk: "low",
    });
    expect(r.final_action).toBe("APPROVE_RUN_ADS");
  });
  it("policy 60 (>=50, <70) -> NEED_EDIT", () => {
    const r = decideFinalAction({
      creative_score: 85,
      policy_safety_score: 60,
      copyright_safety_score: 80,
      final_policy_level: "medium",
      ip_trademark_risk: "low",
    });
    expect(r.final_action).toBe("NEED_EDIT");
  });
  it("creative 72, an toàn nhưng chưa đủ approve -> REMAKE_SAFE", () => {
    const r = decideFinalAction({
      creative_score: 72,
      policy_safety_score: 80,
      copyright_safety_score: 80,
      final_policy_level: "low",
      ip_trademark_risk: "low",
    });
    expect(r.final_action).toBe("REMAKE_SAFE");
  });
  it("final_score = creative*.55 + policy*.30 + copyright*.15", () => {
    const r = decideFinalAction({
      creative_score: 80,
      policy_safety_score: 80,
      copyright_safety_score: 80,
      final_policy_level: "low",
      ip_trademark_risk: "low",
    });
    expect(r.final_score).toBe(80);
  });
});

describe("critical-block booleans (nhóm rủi ro động)", () => {
  it("copyright_critical_block=true -> REJECT_COPYRIGHT_RISK dù điểm cao", () => {
    const r = decideFinalAction({
      creative_score: 90,
      policy_safety_score: 90,
      copyright_safety_score: 90,
      final_policy_level: "low",
      copyright_critical_block: true,
    });
    expect(r.final_action).toBe("REJECT_COPYRIGHT_RISK");
  });

  it("policy_critical_block=true -> REJECT_POLICY_RISK dù final_policy_level thấp", () => {
    const r = decideFinalAction({
      creative_score: 90,
      policy_safety_score: 90,
      copyright_safety_score: 90,
      final_policy_level: "low",
      policy_critical_block: true,
    });
    expect(r.final_action).toBe("REJECT_POLICY_RISK");
  });

  it("boolean=false GHI ĐÈ alias ip_trademark_risk critical (production thắng)", () => {
    const r = decideFinalAction({
      creative_score: 90,
      policy_safety_score: 90,
      copyright_safety_score: 90,
      final_policy_level: "low",
      ip_trademark_risk: "critical",
      copyright_critical_block: false,
    });
    expect(r.final_action).toBe("APPROVE_RUN_ADS");
  });

  it("cả 2 boolean=false + level thấp -> quyết định bình thường (APPROVE)", () => {
    const r = decideFinalAction({
      creative_score: 85,
      policy_safety_score: 85,
      copyright_safety_score: 80,
      final_policy_level: "low",
      policy_critical_block: false,
      copyright_critical_block: false,
    });
    expect(r.final_action).toBe("APPROVE_RUN_ADS");
  });
});

describe("evidence gate (chống chấm chay khi chưa xem video thật)", () => {
  const highScores = {
    creative_score: 90,
    policy_safety_score: 90,
    copyright_safety_score: 90,
    final_policy_level: "low" as const,
  };
  it("evidence_level=text_only + điểm cao -> NEED_EDIT (KHÔNG tự APPROVE)", () => {
    const r = decideFinalAction({ ...highScores, evidence_level: "text_only" });
    expect(r.final_action).toBe("NEED_EDIT");
  });
  it("evidence_level=images_only + điểm cao -> NEED_EDIT", () => {
    const r = decideFinalAction({ ...highScores, evidence_level: "images_only" });
    expect(r.final_action).toBe("NEED_EDIT");
  });
  it("evidence_level=video + điểm cao -> APPROVE_RUN_ADS", () => {
    const r = decideFinalAction({ ...highScores, evidence_level: "video" });
    expect(r.final_action).toBe("APPROVE_RUN_ADS");
  });
  it("không truyền evidence_level -> APPROVE (giữ hành vi cũ)", () => {
    const r = decideFinalAction(highScores);
    expect(r.final_action).toBe("APPROVE_RUN_ADS");
  });
});
