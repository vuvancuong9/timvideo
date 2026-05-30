import { requireRole } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fetchVideos } from "@/lib/videos";
import { AdminVideosClient } from "@/components/admin/AdminVideosClient";
import { VideoFilters } from "@/components/VideoFilters";
import { EmptyState, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AdminVideosPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    source?: string;
    category_id?: string;
    assigned?: string;
  }>;
}) {
  await requireRole(["admin"]);
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();

  const [{ data: categories }, { data: affiliates }, { rows, count }] =
    await Promise.all([
      supabase.from("product_categories").select("id,name").order("name"),
      supabase
        .from("affiliate_accounts")
        .select("id,code,name")
        .order("code"),
      fetchVideos(supabase, {
        q: params.q,
        status: params.status,
        source: params.source,
        categoryId: params.category_id,
        assigned:
          (params.assigned as "assigned" | "unassigned" | undefined) ?? null,
        limit: 500,
      }),
    ]);

  return (
    <div>
      <PageHeader
        title="Tất cả video"
        description={`Toàn quyền chỉnh sửa — tổng ${count} video`}
      />
      <div className="mb-4">
        <VideoFilters
          categories={categories ?? []}
          current={params}
          showAssigned
        />
      </div>
      {rows.length === 0 ? (
        <EmptyState message="Không có video phù hợp bộ lọc." />
      ) : (
        <AdminVideosClient videos={rows} affiliateAccounts={affiliates ?? []} />
      )}
    </div>
  );
}
