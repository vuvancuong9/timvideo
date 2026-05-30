import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  fetchSubmissionById,
  fetchReviewBundle,
} from "@/lib/video-intake/queries";
import { ReviewResult } from "@/components/video-review/ReviewResult";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function StaffReviewDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["staff"]);
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  // RLS đảm bảo staff chỉ đọc được submission của chính mình.
  const submission = await fetchSubmissionById(supabase, id);
  if (!submission) notFound();
  const bundle = await fetchReviewBundle(supabase, id);

  return (
    <div>
      <PageHeader title="Chi tiết chấm điểm video" />
      <ReviewResult submission={submission} bundle={bundle} />
    </div>
  );
}
