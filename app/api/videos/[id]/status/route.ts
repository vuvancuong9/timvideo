import { NextRequest, NextResponse } from "next/server";
import { requireApi } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { writeAuditLog } from "@/lib/audit";
import { ApiError, handleApiError, jsonOk, readJson } from "@/lib/http";
import { Constants } from "@/lib/database.types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const VALID_STATUS = new Set<string>(Constants.public.Enums.video_status);

// PATCH /api/videos/:id/status — aggregator/admin đổi trạng thái.
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await requireApi(["aggregator", "admin"]);
    if (guard instanceof NextResponse) return guard;
    const session = guard;
    const { id } = await ctx.params;

    const body = await readJson<{ status?: string }>(req);
    const status = body.status;
    if (!status || !VALID_STATUS.has(status)) {
      throw new ApiError(400, "Trạng thái không hợp lệ");
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("video_submissions")
      .update({
        status: status as (typeof Constants.public.Enums.video_status)[number],
      })
      .eq("id", id)
      .select("id, status")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new ApiError(404, "Không tìm thấy video");

    await writeAuditLog({
      actorId: session.userId,
      action: "video.status",
      entityType: "video_submission",
      entityId: id,
      after: { status },
    });

    return jsonOk({ video: data });
  } catch (e) {
    return handleApiError(e);
  }
}
