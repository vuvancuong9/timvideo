import Link from "next/link";
import { Badge } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import {
  SOURCE_TYPE_LABELS,
  SUBMISSION_STATUS_LABELS,
  STATUS_COLORS,
  FINAL_ACTION_LABELS,
  FINAL_ACTION_COLORS,
  RISK_LABELS,
  RISK_COLORS,
} from "@/lib/video-intake/labels";
import type { SubmissionWithRelations } from "@/lib/video-intake/queries";
import type { DecisionLite } from "@/lib/video-intake/queries";
import type { RiskLevel } from "@/types/videoReview";

export type DashboardRow = {
  submission: SubmissionWithRelations;
  decision: DecisionLite | null;
  policy_level: RiskLevel | null;
};

export function ReviewDashboardTable({
  items,
  reviewHrefBase,
}: {
  items: DashboardRow[];
  reviewHrefBase: string;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
          <tr>
            <th className="px-3 py-2">Ngày</th>
            <th className="px-3 py-2">Tên sản phẩm</th>
            <th className="px-3 py-2">Nhân viên</th>
            <th className="px-3 py-2">Nguồn</th>
            <th className="px-3 py-2">Trạng thái</th>
            <th className="px-3 py-2">Creative</th>
            <th className="px-3 py-2">Policy</th>
            <th className="px-3 py-2">Policy risk</th>
            <th className="px-3 py-2">Final</th>
            <th className="px-3 py-2">Affiliate</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {items.map(({ submission: v, decision: d, policy_level }) => (
            <tr key={v.id} className="hover:bg-gray-50">
              <td className="whitespace-nowrap px-3 py-2 text-gray-500">
                {formatDateTime(v.created_at)}
              </td>
              <td className="px-3 py-2">
                <Link
                  href={`${reviewHrefBase}/${v.id}`}
                  className="block max-w-[220px] truncate font-medium text-brand hover:underline"
                  title={v.product_name ?? v.shopee_product_url}
                >
                  {v.product_name || v.shopee_product_url}
                </Link>
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-gray-600">
                {v.creator?.full_name || v.creator?.email || "—"}
              </td>
              <td className="px-3 py-2">
                <Badge color="gray">{SOURCE_TYPE_LABELS[v.source_type]}</Badge>
              </td>
              <td className="px-3 py-2">
                <Badge color={STATUS_COLORS[v.status]}>
                  {SUBMISSION_STATUS_LABELS[v.status]}
                </Badge>
              </td>
              <td className="px-3 py-2">
                {d ? Number(d.creative_score).toFixed(0) : "—"}
              </td>
              <td className="px-3 py-2">
                {d ? Number(d.policy_safety_score).toFixed(0) : "—"}
              </td>
              <td className="px-3 py-2">
                {policy_level ? (
                  <Badge color={RISK_COLORS[policy_level]}>
                    {RISK_LABELS[policy_level]}
                  </Badge>
                ) : (
                  "—"
                )}
              </td>
              <td className="px-3 py-2">
                {d ? (
                  <Badge color={FINAL_ACTION_COLORS[d.final_action]}>
                    {FINAL_ACTION_LABELS[d.final_action]}
                  </Badge>
                ) : (
                  "—"
                )}
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-gray-600">
                {v.affiliate?.code ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
