import { requireRole } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { EmptyState, PageHeader, StatCard } from "@/components/ui";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function MySalesPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  await requireRole(["staff"]);
  const { from, to } = await searchParams;

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("sales_records")
    .select("*")
    .order("date", { ascending: false });
  if (from) query = query.gte("date", from);
  if (to) query = query.lte("date", to);
  const { data } = await query;
  const sales = data ?? [];

  const totals = sales.reduce(
    (acc, s) => ({
      clicks: acc.clicks + (s.clicks ?? 0),
      orders: acc.orders + (s.orders ?? 0),
      revenue: acc.revenue + Number(s.revenue ?? 0),
      commission: acc.commission + Number(s.commission ?? 0),
    }),
    { clicks: 0, orders: 0, revenue: 0, commission: 0 },
  );

  return (
    <div>
      <PageHeader
        title="Doanh số của tôi"
        description="Chỉ hiển thị doanh số của chính bạn."
      />

      <div className="mb-5">
        <DateRangeFilter from={from} to={to} />
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Tổng clicks" value={formatNumber(totals.clicks)} />
        <StatCard label="Tổng orders" value={formatNumber(totals.orders)} />
        <StatCard label="Doanh thu" value={formatCurrency(totals.revenue)} />
        <StatCard label="Hoa hồng" value={formatCurrency(totals.commission)} />
      </div>

      {sales.length === 0 ? (
        <EmptyState message="Chưa có dữ liệu doanh số trong khoảng thời gian này." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-2">Ngày</th>
                <th className="px-3 py-2">Clicks</th>
                <th className="px-3 py-2">Orders</th>
                <th className="px-3 py-2">Doanh thu</th>
                <th className="px-3 py-2">Hoa hồng</th>
                <th className="px-3 py-2">Nguồn</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sales.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-3 py-2">
                    {formatDate(s.date)}
                  </td>
                  <td className="px-3 py-2">{formatNumber(s.clicks)}</td>
                  <td className="px-3 py-2">{formatNumber(s.orders)}</td>
                  <td className="px-3 py-2">{formatCurrency(s.revenue)}</td>
                  <td className="px-3 py-2">{formatCurrency(s.commission)}</td>
                  <td className="px-3 py-2 text-gray-500">{s.source ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
