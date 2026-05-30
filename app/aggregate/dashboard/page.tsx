import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader, StatCard } from "@/components/ui";
import { formatNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AggregateDashboard() {
  await requireRole(["aggregator"]);
  const supabase = await createSupabaseServerClient();

  const [{ count: total }, { count: unassigned }, { count: assigned }] =
    await Promise.all([
      supabase
        .from("video_submissions")
        .select("id", { count: "exact", head: true }),
      supabase
        .from("video_submissions")
        .select("id", { count: "exact", head: true })
        .is("assigned_affiliate_account_id", null),
      supabase
        .from("video_submissions")
        .select("id", { count: "exact", head: true })
        .not("assigned_affiliate_account_id", "is", null),
    ]);

  return (
    <div>
      <PageHeader
        title="Tổng quan tổng hợp"
        description="Phân loại video vào tài khoản affiliate."
        action={
          <Link
            href="/aggregate/assign"
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
          >
            Phân affiliate →
          </Link>
        }
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Tổng video" value={formatNumber(total ?? 0)} />
        <StatCard
          label="Chưa phân affiliate"
          value={formatNumber(unassigned ?? 0)}
        />
        <StatCard
          label="Đã phân affiliate"
          value={formatNumber(assigned ?? 0)}
        />
      </div>
    </div>
  );
}
