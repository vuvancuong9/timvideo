import { NextRequest, NextResponse } from "next/server";
import { requireApi } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ApiError, handleApiError, jsonOk } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/video-review/jobs/[id] — RLS giới hạn theo visibility của submission.
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await requireApi();
    if (guard instanceof NextResponse) return guard;
    const { id } = await ctx.params;

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("video_review_jobs")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new ApiError(404, "Không tìm thấy job");
    return jsonOk({ job: data });
  } catch (e) {
    return handleApiError(e);
  }
}
