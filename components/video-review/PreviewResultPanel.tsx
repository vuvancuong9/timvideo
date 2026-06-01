import { Badge, Card } from "@/components/ui";
import {
  RISK_LABELS,
  RISK_COLORS,
  readRiskLevel,
  SCORE_LABELS,
  FINAL_ACTION_VERDICT,
  VERDICT_BG,
  CONFIDENCE_HINT,
  scoreWord,
} from "@/lib/video-intake/labels";
import type { PolicyRiskGroup } from "@/lib/video-review/policy-groups-config";
import type {
  ContentAnalysisResult,
  PolicyCheckResult,
  CreativeScoreModelResult,
  FinalDecisionResult,
  RiskLevel,
} from "@/types/videoReview";

export type PreviewData = {
  analysis: ContentAnalysisResult;
  policy: PolicyCheckResult;
  creative: CreativeScoreModelResult & { creative_score: number };
  decision: FinalDecisionResult;
};

function ScoreCard({ label, score }: { label: string; score: number }) {
  const w = scoreWord(score);
  const ring: Record<string, string> = {
    green: "text-green-700",
    yellow: "text-yellow-700",
    red: "text-red-600",
  };
  return (
    <Card>
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">
        {Number(score).toFixed(0)}
        <span className="text-base font-medium text-gray-400">/100</span>
      </p>
      <p className={`text-xs font-semibold ${ring[w.color]}`}>{w.text}</p>
    </Card>
  );
}

function RiskRow({ label, level }: { label: string; level: RiskLevel }) {
  return (
    <div className="flex items-center justify-between border-b border-gray-100 py-1.5 last:border-0">
      <span className="text-sm text-gray-600">{label}</span>
      <Badge color={RISK_COLORS[level]}>{RISK_LABELS[level]}</Badge>
    </div>
  );
}

function ListBlock({
  title,
  items,
  color = "gray",
}: {
  title: string;
  items: string[];
  color?: "gray" | "red" | "green";
}) {
  if (!items || items.length === 0) return null;
  const titleColor =
    color === "red"
      ? "text-red-600"
      : color === "green"
        ? "text-green-700"
        : "text-gray-400";
  return (
    <div className="mt-2">
      <p className={`text-xs font-semibold uppercase ${titleColor}`}>{title}</p>
      <ul className="list-inside list-disc text-sm text-gray-700">
        {items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    </div>
  );
}

export function PreviewResultPanel({
  data,
  riskGroups,
}: {
  data: PreviewData;
  riskGroups: PolicyRiskGroup[];
}) {
  const { analysis, policy, creative, decision } = data;
  const verdict = FINAL_ACTION_VERDICT[decision.final_action];

  return (
    <div className="mt-6 space-y-4">
      {/* KẾT LUẬN TO, DỄ HIỂU NHẤT */}
      <div className={`rounded-xl border-2 p-5 ${VERDICT_BG[verdict.take]}`}>
        <p className="text-lg font-bold">{verdict.headline}</p>
        <p className="mt-1 text-sm">{verdict.detail}</p>
      </div>

      <p className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        ⚠️ Đây là đánh giá bằng AI để tham khảo (chấm thử, chưa lưu). Không đảm
        bảo 100% Facebook/Meta sẽ duyệt hay từ chối.
      </p>

      {/* 4 điểm số kèm chữ */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <ScoreCard label={SCORE_LABELS.creative} score={creative.creative_score} />
        <ScoreCard label={SCORE_LABELS.policy} score={policy.policy_safety_score} />
        <ScoreCard
          label={SCORE_LABELS.copyright}
          score={policy.copyright_safety_score}
        />
        <ScoreCard label={SCORE_LABELS.final} score={decision.final_score} />
      </div>

      <p className="text-xs text-gray-500">
        {CONFIDENCE_HINT[analysis.confidence]}
      </p>

      {/* Rủi ro chính sách */}
      <Card>
        <h3 className="mb-1 font-semibold text-gray-900">
          Khả năng vi phạm chính sách Facebook
        </h3>
        <p className="mb-3 text-xs text-gray-500">
          “An toàn” = ổn. “Cần lưu ý / Rủi ro cao / Rất nguy hiểm” = nên sửa
          hoặc bỏ.
        </p>
        <div className="grid gap-x-8 md:grid-cols-2">
          {riskGroups.map((g) => (
            <RiskRow
              key={g.key}
              label={g.label_vi}
              level={readRiskLevel(policy.risk_scores, null, g.key)}
            />
          ))}
        </div>
        <ListBlock
          title="Vì sao có rủi ro"
          items={policy.risk_reasons}
          color="red"
        />
        <ListBlock
          title="Cách sửa để an toàn hơn"
          items={policy.suggested_fixes}
          color="green"
        />
      </Card>

      {/* Phân tích & gợi ý */}
      <Card>
        <h3 className="mb-3 font-semibold text-gray-900">
          Phân tích video & gợi ý cải thiện
        </h3>
        {analysis.hook_3s && (
          <p className="text-sm">
            <span className="font-medium text-gray-700">3 giây đầu: </span>
            {analysis.hook_3s}
          </p>
        )}
        {analysis.summary && (
          <p className="mt-1 text-sm">
            <span className="font-medium text-gray-700">Tóm tắt: </span>
            {analysis.summary}
          </p>
        )}
        {analysis.product_detected && (
          <p className="mt-1 text-sm">
            <span className="font-medium text-gray-700">Sản phẩm: </span>
            {analysis.product_detected}
          </p>
        )}
        <div className="grid gap-x-8 md:grid-cols-2">
          <ListBlock title="Điểm mạnh" items={analysis.strong_scenes} color="green" />
          <ListBlock title="Điểm yếu" items={analysis.weak_scenes} color="red" />
          <ListBlock title="Ý tưởng làm lại" items={analysis.remake_angles} />
          <ListBlock title="Tiêu đề gợi ý" items={creative.suggested_titles} />
          <ListBlock title="Kịch bản gợi ý" items={creative.suggested_scripts} />
          <ListBlock title="Nên chỉnh sửa" items={creative.suggested_edits} />
        </div>
      </Card>
    </div>
  );
}
