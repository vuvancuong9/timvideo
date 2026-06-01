import { requireRole } from "@/lib/auth/session";
import { Card, PageHeader } from "@/components/ui";
import { FINAL_ACTION_RULES } from "@/lib/video-review/policy-rules";
import { getThresholds } from "@/lib/video-review/policy-config";
import { getRiskGroups } from "@/lib/video-review/policy-groups-config";
import { getConfidenceRule } from "@/lib/video-review/confidence-config";
import { PolicyRulesClient } from "@/components/admin/PolicyRulesClient";
import { RiskGroupsEditor } from "@/components/admin/RiskGroupsEditor";
import { ConfidenceRuleEditor } from "@/components/admin/ConfidenceRuleEditor";

export const dynamic = "force-dynamic";

export default async function AdminPolicyRulesPage() {
  await requireRole(["admin"]);
  const [thresholds, riskGroups, confidenceRule] = await Promise.all([
    getThresholds(),
    getRiskGroups(),
    getConfidenceRule(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Policy & quyết định"
        description="Chỉnh ngưỡng + trọng số, nhóm rủi ro AI chấm và luật độ tin cậy. Áp dụng cho các lần chấm tiếp theo."
      />

      <PolicyRulesClient initial={thresholds} />

      <RiskGroupsEditor initial={riskGroups} />

      <ConfidenceRuleEditor initial={confidenceRule} />

      {/* Thứ tự quyết định deterministic — chỉ đọc (không sửa được). */}
      {FINAL_ACTION_RULES.map((group) => (
        <Card key={group.title}>
          <h2 className="mb-2 font-semibold text-gray-900">{group.title}</h2>
          <ul className="list-inside list-disc space-y-1 text-sm text-gray-700">
            {group.rules.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </Card>
      ))}

      <p className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        ⚠️ Đây là hệ thống chấm điểm rủi ro bằng AI, không đảm bảo 100% quảng
        cáo sẽ được Meta/Facebook duyệt.
      </p>
    </div>
  );
}
