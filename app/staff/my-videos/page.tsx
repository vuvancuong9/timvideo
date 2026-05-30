import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fetchSubmissions } from "@/lib/video-intake/queries";
import { SubmissionTable } from "@/components/video-intake/SubmissionTable";
import { EmptyState, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function MyVideosPage() {
  await requireRole(["staff"]);
  const supabase = await createSupabaseServerClient();
  // RLS: staff chỉ thấy video của chính mình.
  const { rows, count } = await fetchSubmissions(supabase, { limit: 500 });

  return (
    <div>
      <PageHeader
        title="Video của tôi"
        description={`Tổng ${count} video`}
        action={
          <Link
            href="/staff/new-video"
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
          >
            + Nhập video mới
          </Link>
        }
      />
      {rows.length === 0 ? (
        <EmptyState message="Bạn chưa nhập video nào." />
      ) : (
        <SubmissionTable rows={rows} reviewHrefBase="/staff/my-video-reviews" />
      )}
    </div>
  );
}
