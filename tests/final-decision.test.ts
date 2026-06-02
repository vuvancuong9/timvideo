import { describe, expect, it } from "vitest";
import {
  computeContentScore,
  decideFinalAction,
} from "@/lib/video-review/final-decision";
import type {
  CreativeScoreModelResult,
  FinalDecisionInput,
} from "@/types/videoReview";

const baseScores: CreativeScoreModelResult = {
  review_depth_score: 80,
  product_demo_score: 80,
  authenticity_score: 80,
  viral_hook_score: 80,
  retention_score: 80,
  shareability_score: 80,
  sales_conversion_score: 80,
  production_quality_score: 80,
  reasons: [],
  suggested_titles: [],
  suggested_scripts: [],
  suggested_edits: [],
  confidence: "high",
};

/** Input mặc định = video review thật, mọi điểm cao, an toàn → APPROVE. */
const base: FinalDecisionInput = {
  evidence_level: "video",
  video_type: "review",
  is_real_review: true,
  review_depth_score: 80,
  product_demo_score: 80,
  authenticity_score: 80,
  viral_hook_score: 80,
  retention_score: 80,
  shareability_score: 80,
  sales_conversion_score: 80,
  production_quality_score: 80,
  policy_safety_score: 85,
  copyright_safety_score: 85,
  final_policy_level: "low",
  ip_trademark_risk: "low",
  music_copyright_risk: "low",
  ugc_reupload_risk: "low",
  counterfeit_risk: "low",
};
const mk = (over: Partial<FinalDecisionInput>): FinalDecisionInput => ({
  ...base,
  ...over,
});

describe("computeContentScore", () => {
  it("tất cả 80 → 80 (trọng số cộng = 1)", () => {
    expect(computeContentScore(baseScores)).toBe(80);
  });
  it("review_depth cao kéo điểm theo trọng số 0.25", () => {
    const m = { ...baseScores, review_depth_score: 100, sales_conversion_score: 0 };
    // 100*.25 + 80*.20 + 80*.15 + 80*.15 + 80*.15 + 0*.10 = 25+16+12+12+12 = 77
    expect(computeContentScore(m)).toBe(77);
  });
});

describe("decideFinalAction — review / lan tỏa", () => {
  it("1) sales_deal + review_depth thấp → REMAKE_AS_REVIEW (không APPROVE dù policy cao)", () => {
    const r = decideFinalAction(
      mk({
        video_type: "sales_deal",
        is_real_review: false,
        review_depth_score: 25,
        policy_safety_score: 80,
        copyright_safety_score: 80,
      }),
    );
    expect(r.final_action).toBe("REMAKE_AS_REVIEW");
  });

  it("2) text_only điểm cao → NEED_EDIT (KHÔNG APPROVE)", () => {
    const r = decideFinalAction(mk({ evidence_level: "text_only" }));
    expect(r.final_action).toBe("NEED_EDIT");
    expect(r.final_action).not.toBe("APPROVE_RUN_ADS");
  });

  it("3) policy critical → REJECT_POLICY_RISK", () => {
    const r = decideFinalAction(mk({ final_policy_level: "critical" }));
    expect(r.final_action).toBe("REJECT_POLICY_RISK");
  });

  it("4) music_copyright critical → REJECT_COPYRIGHT_RISK", () => {
    const r = decideFinalAction(mk({ music_copyright_risk: "critical" }));
    expect(r.final_action).toBe("REJECT_COPYRIGHT_RISK");
  });

  it("5) review tốt mọi mặt → APPROVE_RUN_ADS", () => {
    const r = decideFinalAction(mk({}));
    expect(r.final_action).toBe("APPROVE_RUN_ADS");
  });

  it("6) review_depth 45 → NEED_EDIT", () => {
    const r = decideFinalAction(
      mk({
        review_depth_score: 45,
        product_demo_score: 65,
        authenticity_score: 65,
        viral_hook_score: 65,
        retention_score: 65,
        shareability_score: 65,
        sales_conversion_score: 65,
        production_quality_score: 65,
      }),
    );
    expect(r.final_action).toBe("NEED_EDIT");
  });

  it("7) ugc_reupload high → NEED_RIGHTS_CHECK", () => {
    const r = decideFinalAction(mk({ ugc_reupload_risk: "high" }));
    expect(r.final_action).toBe("NEED_RIGHTS_CHECK");
  });

  it("final_score = content_score (policy KHÔNG cộng trung bình)", () => {
    const r = decideFinalAction(mk({}));
    expect(r.final_score).toBe(r.content_score);
    expect(r.content_score).toBe(80);
  });
});
