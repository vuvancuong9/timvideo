import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader, StatCard } from "@/components/ui";
import { formatCurrency, formatNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  await requireRole(["admin"]);
  const supabase = await createSupabaseServerClient();

  const [
    { count: videoCount },
    { count: userCount },
    { count: categoryCount },
    { count: affiliateCount },
    { count: unassigned },
    { data: sales },
  ] = await Promise.all([
    supabase.from("video_submissions").select("id", { count: "exact", head: true }),
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase
      .from("product_categories")
      .select("id", { count: "exact", head: true }),
    supabase
      .from("affiliate_accounts")
      .select("id", { count: "exact", head: true }),
    supabase
      .from("video_submissions")
      .select("id", { count: "exact", head: true })
      .is("assigned_affiliate_account_id", null),
    supabase.from("sales_records").select("revenue,commission"),
  ]);

  const totals = (sales ?? []).reduce(
    (acc, s) => ({
      revenue: acc.revenue + Number(s.revenue ?? 0),
      commission: acc.commission + Number(s.commission ?? 0),
    }),
    { revenue: 0, commission: 0 },
  );

  return (
    <div>
      <PageHeader
        title="Tổng quan quản trị"
        description="Toàn quyền hệ thống."
        action={
          <Link
            href="/admin/short-links"
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
          >
            Quản lý link rút gọn →
          </Link>
        }
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Tổng video" value={formatNumber(videoCount ?? 0)} />
        <StatCard
          label="Chưa phân affiliate"
          value={formatNumber(unassigned ?? 0)}
        />
        <StatCard label="Người dùng" value={formatNumber(userCount ?? 0)} />
        <StatCard label="Danh mục" value={formatNumber(categoryCount ?? 0)} />
        <StatCard
          label="Tài khoản affiliate"
          value={formatNumber(affiliateCount ?? 0)}
        />
        <StatCard label="Doanh thu" value={formatCurrency(totals.revenue)} />
        <StatCard label="Hoa hồng" value={formatCurrency(totals.commission)} />
      </div>
    </div>
  );
}
