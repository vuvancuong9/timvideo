import { requireRole } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fetchSubmissions } from "@/lib/video-intake/queries";
import { SubmissionTable } from "@/components/video-intake/SubmissionTable";
import { SubmissionFilters } from "@/components/video-intake/SubmissionFilters";
import { EmptyState, PageHeader } from "@/components/ui";
import type {
  VideoSourceType,
  VideoSubmissionStatus,
} from "@/types/videoIntake";

export const dynamic = "force-dynamic";

export default async function AccountingVideosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; source_type?: string }>;
}) {
  await requireRole(["accountant"]);
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { rows, count } = await fetchSubmissions(supabase, {
    q: params.q,
    status: (params.status as VideoSubmissionStatus) || null,
    source_type: (params.source_type as VideoSourceType) || null,
    limit: 500,
  });

  return (
    <div>
      <PageHeader
        title="Video / Link"
        description={`Tổng ${count} video (chỉ xem)`}
      />
      <div className="mb-4">
        <SubmissionFilters current={params} />
      </div>
      {rows.length === 0 ? (
        <EmptyState message="Không có video phù hợp bộ lọc." />
      ) : (
        <SubmissionTable
          rows={rows}
          show={{ employee: true, affiliate: true, shortLink: true }}
        />
      )}
    </div>
  );
}
