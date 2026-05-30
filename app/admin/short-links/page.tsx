import { requireRole } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fetchSubmissions } from "@/lib/video-intake/queries";
import { ShortLinkClient } from "@/components/video-review/ShortLinkClient";
import { SubmissionFilters } from "@/components/video-intake/SubmissionFilters";
import { EmptyState, PageHeader } from "@/components/ui";
import type {
  VideoSourceType,
  VideoSubmissionStatus,
} from "@/types/videoIntake";

export const dynamic = "force-dynamic";

export default async function AdminShortLinksPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    source_type?: string;
    assigned?: string;
  }>;
}) {
  await requireRole(["admin"]);
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { rows, count } = await fetchSubmissions(supabase, {
    q: params.q,
    status: (params.status as VideoSubmissionStatus) || null,
    source_type: (params.source_type as VideoSourceType) || null,
    assigned: (params.assigned as "assigned" | "unassigned") || null,
    limit: 500,
  });

  return (
    <div>
      <PageHeader
        title="Link rút gọn"
        description={`Điền/sửa link rút gọn (chỉ admin) — ${count} video`}
      />
      <div className="mb-4">
        <SubmissionFilters current={params} showAssigned />
      </div>
      {rows.length === 0 ? (
        <EmptyState message="Không có video phù hợp bộ lọc." />
      ) : (
        <ShortLinkClient rows={rows} />
      )}
    </div>
  );
}
