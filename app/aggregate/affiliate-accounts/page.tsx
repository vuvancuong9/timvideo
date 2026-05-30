import { requireRole } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Badge, EmptyState, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AggregateAffiliateAccountsPage() {
  await requireRole(["aggregator"]);
  const supabase = await createSupabaseServerClient();
  const { data: accounts } = await supabase
    .from("affiliate_accounts")
    .select("*")
    .order("code");

  return (
    <div>
      <PageHeader
        title="Tài khoản affiliate"
        description="Danh sách tài khoản (chỉ xem)."
      />
      {!accounts || accounts.length === 0 ? (
        <EmptyState message="Chưa có tài khoản affiliate nào." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-2">Mã</th>
                <th className="px-3 py-2">Tên</th>
                <th className="px-3 py-2">Nền tảng</th>
                <th className="px-3 py-2">Ghi chú</th>
                <th className="px-3 py-2">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {accounts.map((a) => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium">{a.code}</td>
                  <td className="px-3 py-2">{a.name}</td>
                  <td className="px-3 py-2 text-gray-600">{a.platform}</td>
                  <td className="px-3 py-2 text-gray-500">{a.note ?? "—"}</td>
                  <td className="px-3 py-2">
                    {a.is_active ? (
                      <Badge color="green">Hoạt động</Badge>
                    ) : (
                      <Badge color="gray">Tắt</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
