import { NextRequest, NextResponse } from "next/server";
import { requireApi } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { writeAuditLog } from "@/lib/audit";
import { ApiError, handleApiError, jsonOk, readJson } from "@/lib/http";
import type { Database } from "@/lib/database.types";

export const dynamic = "force-dynamic";

type AffiliateUpdate =
  Database["public"]["Tables"]["affiliate_accounts"]["Update"];

// PATCH /api/admin/affiliate-accounts/:id
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await requireApi(["admin"]);
    if (guard instanceof NextResponse) return guard;
    const session = guard;
    const { id } = await ctx.params;

    const body = await readJson<{
      code?: string;
      name?: string;
      platform?: string;
      note?: string | null;
      is_active?: boolean;
    }>(req);

    const update: AffiliateUpdate = {};
    if (body.code !== undefined) update.code = body.code.trim();
    if (body.name !== undefined) update.name = body.name.trim();
    if (body.platform !== undefined) update.platform = body.platform.trim();
    if (body.note !== undefined) update.note = body.note?.trim() || null;
    if (body.is_active !== undefined) update.is_active = body.is_active;
    if (Object.keys(update).length === 0) {
      throw new ApiError(400, "Không có trường nào để cập nhật");
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("affiliate_accounts")
      .update(update)
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new ApiError(404, "Không tìm thấy tài khoản affiliate");

    await writeAuditLog({
      actorId: session.userId,
      action: "affiliate_account.update",
      entityType: "affiliate_account",
      entityId: id,
      after: update,
    });
    return jsonOk({ affiliateAccount: data });
  } catch (e) {
    return handleApiError(e);
  }
}
