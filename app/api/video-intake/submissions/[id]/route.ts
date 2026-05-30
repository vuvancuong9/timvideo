import { NextRequest, NextResponse } from "next/server";
import { requireApi } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  assertCanUpdateSubmissionPatch,
  canViewSubmission,
} from "@/lib/auth/role-guard";
import { writeAuditLog } from "@/lib/audit";
import { ApiError, handleApiError, jsonOk, readJson } from "@/lib/http";
import type { Database } from "@/lib/database.types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SubmissionUpdate =
  Database["public"]["Tables"]["video_submissions"]["Update"];

// GET /api/video-intake/submissions/[id]
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
      .from("video_submissions")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new ApiError(404, "Không tìm thấy video");
    return jsonOk({ submission: data });
  } catch (e) {
    return handleApiError(e);
  }
}

// PATCH /api/video-intake/submissions/[id] — field-level enforcement.
const PATCHABLE = new Set<string>([
  "shopee_product_url",
  "product_price",
  "commission_percent",
  "category_id",
  "original_video_url",
  "staff_note",
  "aggregate_note",
  "admin_note",
  "status",
  "assigned_affiliate_account_id",
  "short_link",
]);

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await requireApi();
    if (guard instanceof NextResponse) return guard;
    const session = guard;
    const { id } = await ctx.params;

    const body = await readJson<Record<string, unknown>>(req);
    const patch: Record<string, unknown> = {};
    for (const k of Object.keys(body)) {
      if (PATCHABLE.has(k)) patch[k] = body[k];
    }

    const supabase = await createSupabaseServerClient();
    const { data: before } = await supabase
      .from("video_submissions")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (!before) throw new ApiError(404, "Không tìm thấy video");
    if (!canViewSubmission(session, before)) {
      throw new ApiError(403, "Bạn không có quyền với video này", "FORBIDDEN");
    }

    const isCreator = before.created_by === session.userId;
    const isReviewed = !["submitted", "queued", "processing"].includes(
      before.status,
    );
    assertCanUpdateSubmissionPatch(session, patch, { isCreator, isReviewed });

    const update = patch as SubmissionUpdate;
    if (update.product_price !== undefined) {
      update.product_price = Number(update.product_price);
    }
    if (update.commission_percent !== undefined) {
      update.commission_percent = Number(update.commission_percent);
    }

    const { data, error } = await supabase
      .from("video_submissions")
      .update(update)
      .eq("id", id)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new ApiError(404, "Không tìm thấy video");

    await writeAuditLog({
      actorId: session.userId,
      action: "submission.update",
      entityType: "video_submission",
      entityId: id,
      before,
      after: update,
    });
    return jsonOk({ id: data.id });
  } catch (e) {
    return handleApiError(e);
  }
}
