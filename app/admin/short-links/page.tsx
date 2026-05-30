import { requireRole } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fetchVideos } from "@/lib/videos";
import { ShortLinksClient } from "@/components/admin/ShortLinksClient";
import { VideoFilters } from "@/components/VideoFilters";
import { EmptyState, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AdminShortLinksPage({
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

  const [{ data: categories }, { rows, count }] = await Promise.all([
    supabase.from("product_categories").select("id,name").order("name"),
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
        title="Link rút gọn"
        description={`Điền/sửa link rút gọn (chỉ admin) — ${count} video`}
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
        <ShortLinksClient videos={rows} />
      )}
    </div>
  );
}
