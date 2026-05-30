import { NextRequest, NextResponse } from "next/server";
import { requireApi } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { writeAuditLog } from "@/lib/audit";
import { ApiError, handleApiError, jsonOk, readJson } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// PATCH /api/admin/video-submissions/[id]/short-link — CHỈ admin.
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await requireApi(["admin"]);
    if (guard instanceof NextResponse) return guard;
    const session = guard;
    const { id } = await ctx.params;

    const body = await readJson<{ short_link?: string | null }>(req);
    const shortLink = (body.short_link ?? "").trim() || null;

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("video_submissions")
      .update({
        short_link: shortLink,
        short_link_by: session.userId,
        short_link_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("id, short_link")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new ApiError(404, "Không tìm thấy video");

    await writeAuditLog({
      actorId: session.userId,
      action: "submission.short_link",
      entityType: "video_submission",
      entityId: id,
      after: { short_link: shortLink },
    });

    return jsonOk({ submission: data });
  } catch (e) {
    return handleApiError(e);
  }
}
