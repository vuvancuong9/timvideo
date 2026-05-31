import { Badge, Card, StatCard } from "@/components/ui";
import {
  RISK_LABELS,
  RISK_COLORS,
  FINAL_ACTION_LABELS,
  FINAL_ACTION_COLORS,
  CONFIDENCE_LABELS,
} from "@/lib/video-intake/labels";
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

function RiskRow({ label, level }: { label: string; level: RiskLevel }) {
  return (
    <div className="flex items-center justify-between border-b border-gray-100 py-1.5 last:border-0">
      <span className="text-sm text-gray-600">{label}</span>
      <Badge color={RISK_COLORS[level]}>{RISK_LABELS[level]}</Badge>
    </div>
  );
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="mt-2">
      <p className="text-xs font-semibold uppercase text-gray-400">{title}</p>
      <ul className="list-inside list-disc text-sm text-gray-700">
        {items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    </div>
  );
}

export function PreviewResultPanel({ data }: { data: PreviewData }) {
  const { analysis, policy, creative, decision } = data;

  return (
    <div className="mt-6 space-y-4">
      <p className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        ⚠️ Đây là kết quả chấm điểm rủi ro bằng AI (chấm thử, chưa lưu), không
        đảm bảo 100% quảng cáo sẽ được Meta/Facebook duyệt.
      </p>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Creative Score"
          value={Number(creative.creative_score).toFixed(0)}
        />
        <StatCard
          label="FB Policy Safety"
          value={Number(policy.policy_safety_score).toFixed(0)}
        />
        <StatCard
          label="Copyright Safety"
          value={Number(policy.copyright_safety_score).toFixed(0)}
        />
        <StatCard
          label="Final Score"
          value={Number(decision.final_score).toFixed(0)}
        />
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-gray-600">
            Hành động đề xuất:
          </span>
          <Badge color={FINAL_ACTION_COLORS[decision.final_action]}>
            {FINAL_ACTION_LABELS[decision.final_action]}
          </Badge>
          <span className="text-xs text-gray-400">
            (độ tin cậy phân tích: {CONFIDENCE_LABELS[analysis.confidence]})
          </span>
        </div>
        {decision.decision_reason && (
          <p className="mt-2 text-sm text-gray-600">{decision.decision_reason}</p>
        )}
        {decision.blocking_reasons.length > 0 && (
          <ListBlock title="Lý do chặn" items={decision.blocking_reasons} />
        )}
      </Card>

      <Card>
        <h3 className="mb-3 font-semibold text-gray-900">Rủi ro chính sách</h3>
        <div className="grid gap-x-8 md:grid-cols-2">
          <div>
            <RiskRow label="Misleading claim" level={policy.misleading_claim_risk} />
            <RiskRow label="Health claim" level={policy.health_claim_risk} />
            <RiskRow
              label="Personal attribute"
              level={policy.personal_attribute_risk}
            />
            <RiskRow label="Before/After" level={policy.before_after_risk} />
          </div>
          <div>
            <RiskRow
              label="Shocking content"
              level={policy.shocking_content_risk}
            />
            <RiskRow
              label="Adult/Sensitive"
              level={policy.adult_sensitive_risk}
            />
            <RiskRow label="IP/Trademark" level={policy.ip_trademark_risk} />
            <RiskRow
              label="Restricted product"
              level={policy.restricted_product_risk}
            />
          </div>
        </div>
        <ListBlock title="Lý do cảnh báo" items={policy.risk_reasons} />
        <ListBlock title="Đề xuất sửa" items={policy.suggested_fixes} />
      </Card>

      <Card>
        <h3 className="mb-3 font-semibold text-gray-900">Phân tích & gợi ý</h3>
        {analysis.hook_3s && (
          <p className="text-sm">
            <span className="font-medium text-gray-700">Hook 3s: </span>
            {analysis.hook_3s}
          </p>
        )}
        {analysis.summary && (
          <p className="mt-1 text-sm">
            <span className="font-medium text-gray-700">Tóm tắt: </span>
            {analysis.summary}
          </p>
        )}
        <div className="grid gap-x-8 md:grid-cols-2">
          <ListBlock title="Cảnh mạnh" items={analysis.strong_scenes} />
          <ListBlock title="Cảnh yếu" items={analysis.weak_scenes} />
          <ListBlock title="Góc remake" items={analysis.remake_angles} />
          <ListBlock title="Tiêu đề gợi ý" items={creative.suggested_titles} />
          <ListBlock title="Kịch bản gợi ý" items={creative.suggested_scripts} />
          <ListBlock title="Chỉnh sửa gợi ý" items={creative.suggested_edits} />
        </div>
      </Card>
    </div>
  );
}
