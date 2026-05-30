import { NextRequest, NextResponse } from "next/server";
import { requireApi } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  fetchSubmissionById,
  fetchReviewBundle,
} from "@/lib/video-intake/queries";
import { ApiError, handleApiError, jsonOk } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/video-review/results/[submissionId] — analysis + policy + creative + decision.
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ submissionId: string }> },
) {
  try {
    const guard = await requireApi();
    if (guard instanceof NextResponse) return guard;
    const { submissionId } = await ctx.params;

    const supabase = await createSupabaseServerClient();
    const submission = await fetchSubmissionById(supabase, submissionId);
    if (!submission) throw new ApiError(404, "Không tìm thấy video");
    const bundle = await fetchReviewBundle(supabase, submissionId);

    return jsonOk({ submission, ...bundle });
  } catch (e) {
    return handleApiError(e);
  }
}
