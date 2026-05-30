import { requireRole } from "@/lib/auth/session";
import { Card, PageHeader } from "@/components/ui";
import {
  FINAL_ACTION_RULES,
  FINAL_DECISION_WEIGHTS,
} from "@/lib/video-review/policy-rules";

export const dynamic = "force-dynamic";

export default async function AdminPolicyRulesPage() {
  await requireRole(["admin"]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Policy & quyết định"
        description="Logic deterministic mà hệ thống dùng để ra hành động cuối (read-only)."
      />

      <Card>
        <h2 className="mb-2 font-semibold text-gray-900">Công thức điểm</h2>
        <p className="text-sm text-gray-600">
          <strong>creative_score</strong> = {FINAL_DECISION_WEIGHTS.creative_score}
        </p>
        <p className="mt-1 text-sm text-gray-600">
          <strong>final_score</strong> = {FINAL_DECISION_WEIGHTS.final_score}
        </p>
      </Card>

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
