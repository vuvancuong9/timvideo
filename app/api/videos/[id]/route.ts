import { NextRequest, NextResponse } from "next/server";
import { requireApi } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { canUpdateVideoFields } from "@/lib/permissions";
import { writeAuditLog } from "@/lib/audit";
import { ApiError, handleApiError, jsonOk, readJson } from "@/lib/http";
import type { Database } from "@/lib/database.types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type VideoUpdate = Database["public"]["Tables"]["video_submissions"]["Update"];

// Admin được sửa các trường này. aggregator bị giới hạn bởi canUpdateVideoFields.
const ADMIN_EDITABLE = new Set<string>([
  "shopee_product_url",
  "product_price",
  "commission_percent",
  "category_id",
  "status",
  "staff_note",
  "aggregate_note",
  "admin_note",
  "assigned_affiliate_account_id",
  "short_link",
]);

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await requireApi(["aggregator", "admin"]);
    if (guard instanceof NextResponse) return guard;
    const session = guard;
    const { id } = await ctx.params;

    const body = await readJson<Record<string, unknown>>(req);
    const fields = Object.keys(body);
    if (fields.length === 0) {
      throw new ApiError(400, "Không có trường nào để cập nhật");
    }
    // Whitelist theo role (staff/accountant -> false; aggregator -> chỉ assign/status/note).
    if (!canUpdateVideoFields(session.role, fields)) {
      throw new ApiError(
        403,
        "Bạn không được phép sửa các trường này",
        "FORBIDDEN",
      );
    }
    if (session.role === "admin" && !fields.every((f) => ADMIN_EDITABLE.has(f))) {
      throw new ApiError(400, "Có trường không được phép cập nhật");
    }

    const supabase = await createSupabaseServerClient();
    const { data: before } = await supabase
      .from("video_submissions")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (!before) throw new ApiError(404, "Không tìm thấy video");

    const update: VideoUpdate = {};
    for (const f of fields) {
      (update as Record<string, unknown>)[f] = body[f];
    }

    const nowIso = new Date().toISOString();
    if (update.product_price !== undefined) {
      update.product_price = Number(update.product_price);
    }
    if (update.commission_percent !== undefined) {
      update.commission_percent = Number(update.commission_percent);
    }
    if (
      update.product_price !== undefined ||
      update.commission_percent !== undefined
    ) {
      const price = update.product_price ?? before.product_price;
      const pct = update.commission_percent ?? before.commission_percent;
      update.estimated_commission = Math.round(price * pct) / 100;
    }
    if ("assigned_affiliate_account_id" in body) {
      update.assigned_by = session.userId;
      update.assigned_at = nowIso;
      if (update.assigned_affiliate_account_id && !("status" in body)) {
        update.status = "assigned";
      }
    }
    if ("short_link" in body && session.role === "admin") {
      update.short_link_by = session.userId;
      update.short_link_at = nowIso;
      if (update.short_link && !("status" in body)) {
        update.status = "short_linked";
      }
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
      action: "video.update",
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
