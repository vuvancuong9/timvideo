import { requireRole } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader, StatCard } from "@/components/ui";
import { formatCurrency, formatNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AccountingDashboard() {
  await requireRole(["accountant"]);
  const supabase = await createSupabaseServerClient();

  const [{ count: videoCount }, { count: staffCount }, { data: sales }] =
    await Promise.all([
      supabase
        .from("video_submissions")
        .select("id", { count: "exact", head: true }),
      supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "staff"),
      supabase.from("sales_records").select("revenue,commission,clicks,orders"),
    ]);

  const totals = (sales ?? []).reduce(
    (acc, s) => ({
      revenue: acc.revenue + Number(s.revenue ?? 0),
      commission: acc.commission + Number(s.commission ?? 0),
      clicks: acc.clicks + (s.clicks ?? 0),
      orders: acc.orders + (s.orders ?? 0),
    }),
    { revenue: 0, commission: 0, clicks: 0, orders: 0 },
  );

  return (
    <div>
      <PageHeader
        title="Tổng quan kế toán"
        description="Toàn bộ số liệu (chỉ xem)."
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard label="Tổng video/link" value={formatNumber(videoCount ?? 0)} />
        <StatCard label="Nhân viên (staff)" value={formatNumber(staffCount ?? 0)} />
        <StatCard label="Tổng đơn" value={formatNumber(totals.orders)} />
        <StatCard label="Tổng clicks" value={formatNumber(totals.clicks)} />
        <StatCard label="Doanh thu" value={formatCurrency(totals.revenue)} />
        <StatCard label="Hoa hồng" value={formatCurrency(totals.commission)} />
      </div>
    </div>
  );
}
