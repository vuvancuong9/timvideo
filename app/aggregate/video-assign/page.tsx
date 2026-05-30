import { requireRole } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fetchSubmissions } from "@/lib/video-intake/queries";
import { AssignClient } from "@/components/video-review/AssignClient";
import { SubmissionFilters } from "@/components/video-intake/SubmissionFilters";
import { EmptyState, PageHeader } from "@/components/ui";
import type {
  VideoSourceType,
  VideoSubmissionStatus,
} from "@/types/videoIntake";

export const dynamic = "force-dynamic";

export default async function VideoAssignPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    source_type?: string;
    assigned?: string;
  }>;
}) {
  await requireRole(["aggregator"]);
  const params = await searchParams;
  // Mặc định hiển thị video CHƯA phân affiliate.
  const assigned =
    (params.assigned as "assigned" | "unassigned" | undefined) ?? "unassigned";

  const supabase = await createSupabaseServerClient();
  const [{ data: affiliates }, { rows }] = await Promise.all([
    supabase
      .from("affiliate_accounts")
      .select("id,code,name")
      .eq("is_active", true)
      .order("code"),
    fetchSubmissions(supabase, {
      q: params.q,
      status: (params.status as VideoSubmissionStatus) || null,
      source_type: (params.source_type as VideoSourceType) || null,
      assigned,
      limit: 500,
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="Phân affiliate"
        description="Phân video vào tài khoản affiliate (đơn lẻ hoặc hàng loạt)."
      />
      <div className="mb-4">
        <SubmissionFilters current={{ ...params, assigned }} showAssigned />
      </div>
      {rows.length === 0 ? (
        <EmptyState message="Không có video nào phù hợp." />
      ) : (
        <AssignClient rows={rows} affiliateAccounts={affiliates ?? []} />
      )}
    </div>
  );
}
