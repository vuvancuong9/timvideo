import { requireRole } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadReviewDashboard } from "@/lib/video-intake/dashboard-data";
import { ReviewDashboardTable } from "@/components/video-review/ReviewDashboardTable";
import { ReviewDashboardFilters } from "@/components/video-review/ReviewDashboardFilters";
import { AiDisclaimer } from "@/components/video-review/ReviewResult";
import { EmptyState, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AdminVideoReviewsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  await requireRole(["admin"]);
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  const items = await loadReviewDashboard(supabase, params);

  return (
    <div>
      <PageHeader
        title="Video & review (admin)"
        description={`Tổng ${items.length} video — toàn quyền xem/sửa.`}
      />
      <div className="mb-4 space-y-3">
        <AiDisclaimer />
        <ReviewDashboardFilters current={params} />
      </div>
      {items.length === 0 ? (
        <EmptyState message="Không có video phù hợp bộ lọc." />
      ) : (
        <ReviewDashboardTable
          items={items}
          reviewHrefBase="/admin/video-reviews"
        />
      )}
    </div>
  );
}
