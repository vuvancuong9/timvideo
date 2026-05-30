import { NextRequest, NextResponse } from "next/server";
import { requireApi } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { writeAuditLog } from "@/lib/audit";
import { ApiError, handleApiError, jsonOk, readJson } from "@/lib/http";
import type { Database } from "@/lib/database.types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SubmissionUpdate =
  Database["public"]["Tables"]["video_submissions"]["Update"];

// PATCH /api/aggregate/video-submissions/[id]/assign-affiliate — aggregator/admin.
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await requireApi(["aggregator", "admin"]);
    if (guard instanceof NextResponse) return guard;
    const session = guard;
    const { id } = await ctx.params;

    const body = await readJson<{
      affiliate_account_id?: string | null;
      aggregate_note?: string | null;
    }>(req);
    const affiliateId = body.affiliate_account_id ?? null;

    const update: SubmissionUpdate = {
      assigned_affiliate_account_id: affiliateId,
      assigned_by: session.userId,
      assigned_at: new Date().toISOString(),
    };
    if (body.aggregate_note !== undefined) {
      update.aggregate_note = body.aggregate_note;
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("video_submissions")
      .update(update)
      .eq("id", id)
      .select("id, assigned_affiliate_account_id")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new ApiError(404, "Không tìm thấy video");

    await writeAuditLog({
      actorId: session.userId,
      action: "submission.assign_affiliate",
      entityType: "video_submission",
      entityId: id,
      after: { assigned_affiliate_account_id: affiliateId },
    });

    return jsonOk({ submission: data });
  } catch (e) {
    return handleApiError(e);
  }
}
