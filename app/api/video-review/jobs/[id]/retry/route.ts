import { NextRequest, NextResponse } from "next/server";
import { requireApi } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { writeAuditLog } from "@/lib/audit";
import { ApiError, handleApiError, jsonOk } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// POST /api/video-review/jobs/[id]/retry — admin only. Đưa job về queued + reset attempt.
export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await requireApi(["admin"]);
    if (guard instanceof NextResponse) return guard;
    const session = guard;
    const { id } = await ctx.params;

    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("video_review_jobs")
      .update({
        status: "queued",
        stage: "queued",
        attempt_count: 0,
        locked_by: null,
        locked_at: null,
        error: null,
        finished_at: null,
      })
      .eq("id", id)
      .select("id, video_submission_id")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new ApiError(404, "Không tìm thấy job");

    await admin
      .from("video_submissions")
      .update({ status: "queued" })
      .eq("id", data.video_submission_id);

    await writeAuditLog({
      actorId: session.userId,
      action: "review_job.retry",
      entityType: "video_review_job",
      entityId: id,
    });

    return jsonOk({ id: data.id });
  } catch (e) {
    return handleApiError(e);
  }
}
