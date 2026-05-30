import { requireRole } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fetchVideos } from "@/lib/videos";
import { VideoTable } from "@/components/VideoTable";
import { VideoFilters } from "@/components/VideoFilters";
import { EmptyState, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AccountingVideosPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    source?: string;
    category_id?: string;
  }>;
}) {
  await requireRole(["accountant"]);
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();

  const [{ data: categories }, { rows, count }] = await Promise.all([
    supabase.from("product_categories").select("id,name").order("name"),
    fetchVideos(supabase, {
      q: params.q,
      status: params.status,
      source: params.source,
      categoryId: params.category_id,
      limit: 500,
    }),
  ]);

  return (
    <div>
      <PageHeader title="Video / Link" description={`Tổng ${count} video (chỉ xem)`} />
      <div className="mb-4">
        <VideoFilters categories={categories ?? []} current={params} />
      </div>
      {rows.length === 0 ? (
        <EmptyState message="Không có video phù hợp bộ lọc." />
      ) : (
        <VideoTable
          rows={rows}
          show={{ employee: true, affiliate: true, shortLink: true }}
        />
      )}
    </div>
  );
}
