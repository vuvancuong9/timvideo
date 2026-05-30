import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  fetchSubmissionById,
  fetchReviewBundle,
} from "@/lib/video-intake/queries";
import { ReviewResult } from "@/components/video-review/ReviewResult";
import { AdminReviewActions } from "@/components/video-review/AdminReviewActions";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AdminReviewDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["admin"]);
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const submission = await fetchSubmissionById(supabase, id);
  if (!submission) notFound();
  const [bundle, { data: affiliates }] = await Promise.all([
    fetchReviewBundle(supabase, id),
    supabase.from("affiliate_accounts").select("id,code,name").order("code"),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Chi tiết review (admin)" />
      <AdminReviewActions
        submission={submission}
        affiliateAccounts={affiliates ?? []}
      />
      <ReviewResult submission={submission} bundle={bundle} />
    </div>
  );
}
