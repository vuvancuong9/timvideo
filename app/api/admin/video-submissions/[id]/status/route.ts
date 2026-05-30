import { NextRequest, NextResponse } from "next/server";
import { requireApi } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { writeAuditLog } from "@/lib/audit";
import { ApiError, handleApiError, jsonOk, readJson } from "@/lib/http";
import { Constants } from "@/lib/database.types";
import type { Database } from "@/lib/database.types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const VALID = new Set<string>(Constants.public.Enums.video_submission_status);

// PATCH /api/admin/video-submissions/[id]/status — admin đổi trạng thái.
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await requireApi(["admin"]);
    if (guard instanceof NextResponse) return guard;
    const session = guard;
    const { id } = await ctx.params;

    const body = await readJson<{ status?: string }>(req);
    if (!body.status || !VALID.has(body.status)) {
      throw new ApiError(400, "Trạng thái không hợp lệ");
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("video_submissions")
      .update({
        status:
          body.status as Database["public"]["Enums"]["video_submission_status"],
      })
      .eq("id", id)
      .select("id, status")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new ApiError(404, "Không tìm thấy video");

    await writeAuditLog({
      actorId: session.userId,
      action: "submission.status_change",
      entityType: "video_submission",
      entityId: id,
      after: { status: body.status },
    });

    return jsonOk({ submission: data });
  } catch (e) {
    return handleApiError(e);
  }
}
