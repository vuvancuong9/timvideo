import { requireRole } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fetchVideos } from "@/lib/videos";
import { AssignVideosClient } from "@/components/AssignVideosClient";
import { VideoFilters } from "@/components/VideoFilters";
import { EmptyState, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AssignPage({
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
  await requireRole(["aggregator"]);
  const params = await searchParams;
  // Mặc định hiển thị video CHƯA phân affiliate.
  const assigned =
    (params.assigned as "assigned" | "unassigned" | undefined) ?? "unassigned";

  const supabase = await createSupabaseServerClient();
  const [{ data: affiliates }, { data: categories }, { rows }] =
    await Promise.all([
      supabase
        .from("affiliate_accounts")
        .select("id,code,name")
        .eq("is_active", true)
        .order("code"),
      supabase.from("product_categories").select("id,name").order("name"),
      fetchVideos(supabase, {
        q: params.q,
        status: params.status,
        source: params.source,
        categoryId: params.category_id,
        assigned,
        limit: 300,
      }),
    ]);

  return (
    <div>
      <PageHeader
        title="Phân affiliate"
        description="Chọn tài khoản affiliate cho từng video hoặc phân hàng loạt."
      />
      <div className="mb-4">
        <VideoFilters
          categories={categories ?? []}
          current={{ ...params, assigned }}
          showAssigned
        />
      </div>
      {rows.length === 0 ? (
        <EmptyState message="Không có video nào phù hợp." />
      ) : (
        <AssignVideosClient
          videos={rows}
          affiliateAccounts={affiliates ?? []}
        />
      )}
    </div>
  );
}
