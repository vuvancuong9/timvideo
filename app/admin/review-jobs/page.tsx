import { requireRole } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ReviewJobsClient } from "@/components/video-review/ReviewJobsClient";
import { EmptyState, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AdminReviewJobsPage() {
  await requireRole(["admin"]);
  const supabase = await createSupabaseServerClient();
  const { data: jobs } = await supabase
    .from("video_review_jobs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(300);

  return (
    <div>
      <PageHeader
        title="Review jobs"
        description="Job xử lý nền (queued / running / done / failed). Có thể retry."
      />
      {!jobs || jobs.length === 0 ? (
        <EmptyState message="Chưa có job nào." />
      ) : (
        <ReviewJobsClient jobs={jobs} />
      )}
    </div>
  );
}
