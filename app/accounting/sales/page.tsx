import { requireRole } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { EmptyState, PageHeader, StatCard } from "@/components/ui";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";
import type { Database } from "@/lib/database.types";

export const dynamic = "force-dynamic";

type SalesWithEmployee =
  Database["public"]["Tables"]["sales_records"]["Row"] & {
    employee: { full_name: string | null; email: string } | null;
  };

export default async function AccountingSalesPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; employee_id?: string }>;
}) {
  await requireRole(["accountant"]);
  const { from, to, employee_id } = await searchParams;
  const supabase = await createSupabaseServerClient();

  let salesQuery = supabase
    .from("sales_records")
    .select(
      "*, employee:profiles!sales_records_employee_id_fkey(full_name,email)",
    )
    .order("date", { ascending: false });
  if (from) salesQuery = salesQuery.gte("date", from);
  if (to) salesQuery = salesQuery.lte("date", to);
  if (employee_id) salesQuery = salesQuery.eq("employee_id", employee_id);

  const [{ data: employees }, { data: salesData }] = await Promise.all([
    supabase.from("profiles").select("id,full_name,email").order("full_name"),
    salesQuery,
  ]);

  const sales = (salesData ?? []) as unknown as SalesWithEmployee[];
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
        title="Doanh số toàn bộ"
        description="Số liệu toàn bộ nhân viên (chỉ xem)."
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
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">
            Nhân viên
          </label>
          <select
            name="employee_id"
            defaultValue={employee_id ?? ""}
            className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
          >
            <option value="">Tất cả</option>
            {(employees ?? []).map((e) => (
              <option key={e.id} value={e.id}>
                {e.full_name || e.email}
              </option>
            ))}
          </select>
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

      {sales.length === 0 ? (
        <EmptyState message="Không có dữ liệu doanh số." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-2">Ngày</th>
                <th className="px-3 py-2">Nhân viên</th>
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
                  <td className="px-3 py-2 text-gray-600">
                    {s.employee?.full_name || s.employee?.email || "—"}
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
