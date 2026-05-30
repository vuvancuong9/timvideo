import { NextRequest, NextResponse } from "next/server";
import { requireApi } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { writeAuditLog } from "@/lib/audit";
import { ApiError, handleApiError, jsonOk, readJson } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// PATCH /api/aggregate/video-submissions/[id]/note — aggregator/admin ghi chú tổng hợp.
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await requireApi(["aggregator", "admin"]);
    if (guard instanceof NextResponse) return guard;
    const session = guard;
    const { id } = await ctx.params;

    const body = await readJson<{ aggregate_note?: string | null }>(req);

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("video_submissions")
      .update({ aggregate_note: body.aggregate_note ?? null })
      .eq("id", id)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new ApiError(404, "Không tìm thấy video");

    await writeAuditLog({
      actorId: session.userId,
      action: "submission.aggregate_note",
      entityType: "video_submission",
      entityId: id,
    });

    return jsonOk({ id: data.id });
  } catch (e) {
    return handleApiError(e);
  }
}
