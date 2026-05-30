import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  fetchSubmissions,
  fetchLatestDecisionsMap,
} from "@/lib/video-intake/queries";
import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { AiDisclaimer } from "@/components/video-review/ReviewResult";
import { formatDateTime } from "@/lib/format";
import {
  FINAL_ACTION_LABELS,
  FINAL_ACTION_COLORS,
  SUBMISSION_STATUS_LABELS,
  STATUS_COLORS,
} from "@/lib/video-intake/labels";

export const dynamic = "force-dynamic";

export default async function MyVideoReviewsPage() {
  await requireRole(["staff"]);
  const supabase = await createSupabaseServerClient();
  const { rows } = await fetchSubmissions(supabase, { limit: 500 });
  const decisions = await fetchLatestDecisionsMap(
    supabase,
    rows.map((r) => r.id),
  );

  return (
    <div>
      <PageHeader
        title="Kết quả chấm điểm video của tôi"
        description="Điểm sáng tạo, an toàn chính sách và hành động đề xuất."
      />
      <div className="mb-4">
        <AiDisclaimer />
      </div>
      {rows.length === 0 ? (
        <EmptyState message="Bạn chưa có video nào được chấm." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-2">Ngày</th>
                <th className="px-3 py-2">Sản phẩm</th>
                <th className="px-3 py-2">Trạng thái</th>
                <th className="px-3 py-2">Creative</th>
                <th className="px-3 py-2">Policy</th>
                <th className="px-3 py-2">Final</th>
                <th className="px-3 py-2">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((v) => {
                const d = decisions.get(v.id);
                return (
                  <tr key={v.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-3 py-2 text-gray-500">
                      {formatDateTime(v.created_at)}
                    </td>
                    <td className="px-3 py-2">
                      <Link
                        href={`/staff/my-video-reviews/${v.id}`}
                        className="block max-w-[240px] truncate text-brand hover:underline"
                        title={v.shopee_product_url}
                      >
                        {v.shopee_product_url}
                      </Link>
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
                      {d ? Number(d.final_score).toFixed(0) : "—"}
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
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
