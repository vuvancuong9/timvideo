import { NextRequest, NextResponse } from "next/server";
import { requireApi } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { writeAuditLog } from "@/lib/audit";
import { ApiError, handleApiError, jsonOk, readJson } from "@/lib/http";
import type { Database } from "@/lib/database.types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type VideoUpdate = Database["public"]["Tables"]["video_submissions"]["Update"];

// PATCH /api/videos/:id/short-link — CHỈ admin. aggregator/staff/accountant -> 403.
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

    const update: VideoUpdate = {
      short_link: shortLink,
      short_link_by: session.userId,
      short_link_at: new Date().toISOString(),
    };
    if (shortLink) update.status = "short_linked";

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("video_submissions")
      .update(update)
      .eq("id", id)
      .select("id, short_link, status")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new ApiError(404, "Không tìm thấy video");

    await writeAuditLog({
      actorId: session.userId,
      action: "video.short_link",
      entityType: "video_submission",
      entityId: id,
      after: { short_link: shortLink },
    });

    return jsonOk({ video: data });
  } catch (e) {
    return handleApiError(e);
  }
}
