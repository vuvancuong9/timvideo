import { requireRole } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { EmptyState, PageHeader, StatCard } from "@/components/ui";
import { formatCurrency, formatNumber } from "@/lib/format";
import type { Database } from "@/lib/database.types";

export const dynamic = "force-dynamic";

type SalesRow = Database["public"]["Tables"]["sales_records"]["Row"];

type EmployeeAgg = {
  id: string;
  name: string;
  email: string;
  clicks: number;
  orders: number;
  revenue: number;
  commission: number;
};

export default async function AdminSalesPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  await requireRole(["admin"]);
  const { from, to } = await searchParams;
  const supabase = await createSupabaseServerClient();

  let salesQuery = supabase.from("sales_records").select("*");
  if (from) salesQuery = salesQuery.gte("date", from);
  if (to) salesQuery = salesQuery.lte("date", to);

  const [{ data: employees }, { data: salesData }] = await Promise.all([
    supabase.from("profiles").select("id,full_name,email").order("full_name"),
    salesQuery,
  ]);

  const sales = (salesData ?? []) as SalesRow[];

  // Gộp doanh số theo từng nhân viên.
  const byEmp = new Map<string, EmployeeAgg>();
  for (const e of employees ?? []) {
    byEmp.set(e.id, {
      id: e.id,
      name: e.full_name || e.email,
      email: e.email,
      clicks: 0,
      orders: 0,
      revenue: 0,
      commission: 0,
    });
  }
  for (const s of sales) {
    const agg = byEmp.get(s.employee_id);
    if (!agg) continue;
    agg.clicks += s.clicks ?? 0;
    agg.orders += s.orders ?? 0;
    agg.revenue += Number(s.revenue ?? 0);
    agg.commission += Number(s.commission ?? 0);
  }

  // Chỉ hiện nhân viên có số liệu, sắp xếp theo hoa hồng giảm dần.
  const rows = Array.from(byEmp.values())
    .filter((r) => r.clicks || r.orders || r.revenue || r.commission)
    .sort((a, b) => b.commission - a.commission);

  const totals = rows.reduce(
    (acc, r) => ({
      clicks: acc.clicks + r.clicks,
      orders: acc.orders + r.orders,
      revenue: acc.revenue + r.revenue,
      commission: acc.commission + r.commission,
    }),
    { clicks: 0, orders: 0, revenue: 0, commission: 0 },
  );

  return (
    <div>
      <PageHeader
        title="Doanh số theo nhân viên"
        description="Tổng hợp doanh số từng nhân viên."
      />

      <form
        method="get"
        className="mb-5 flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-3"
      >
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">
            Từ ngày
          </label>
          <input
            type="date"
            name="from"
            defaultValue={from}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">
            Đến ngày
          </label>
          <input
            type="date"
            name="to"
            defaultValue={to}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
          />
        </div>
        <button
          type="submit"
          className="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-dark"
        >
          Lọc
        </button>
      </form>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Tổng clicks" value={formatNumber(totals.clicks)} />
        <StatCard label="Tổng orders" value={formatNumber(totals.orders)} />
        <StatCard label="Doanh thu" value={formatCurrency(totals.revenue)} />
        <StatCard label="Hoa hồng" value={formatCurrency(totals.commission)} />
      </div>

      {rows.length === 0 ? (
        <EmptyState message="Chưa có dữ liệu doanh số. Nhập doanh số ở trang Cấu hình (CSV)." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-2">Nhân viên</th>
                <th className="px-3 py-2">Clicks</th>
                <th className="px-3 py-2">Orders</th>
                <th className="px-3 py-2">Doanh thu</th>
                <th className="px-3 py-2">Hoa hồng</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2">
                    <div className="font-medium text-gray-800">{r.name}</div>
                    <div className="text-xs text-gray-400">{r.email}</div>
                  </td>
                  <td className="px-3 py-2">{formatNumber(r.clicks)}</td>
                  <td className="px-3 py-2">{formatNumber(r.orders)}</td>
                  <td className="px-3 py-2">{formatCurrency(r.revenue)}</td>
                  <td className="px-3 py-2 font-semibold">
                    {formatCurrency(r.commission)}
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
