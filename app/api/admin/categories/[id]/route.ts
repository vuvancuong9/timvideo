import { NextRequest, NextResponse } from "next/server";
import { requireApi } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { writeAuditLog } from "@/lib/audit";
import { ApiError, handleApiError, jsonOk, readJson } from "@/lib/http";
import type { Database } from "@/lib/database.types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type CategoryUpdate = Database["public"]["Tables"]["product_categories"]["Update"];

// PATCH /api/admin/categories/:id
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
      name?: string;
      description?: string | null;
      is_active?: boolean;
    }>(req);

    const update: CategoryUpdate = {};
    if (body.name !== undefined) update.name = body.name.trim();
    if (body.description !== undefined) {
      update.description = body.description?.trim() || null;
    }
    if (body.is_active !== undefined) update.is_active = body.is_active;
    if (Object.keys(update).length === 0) {
      throw new ApiError(400, "Không có trường nào để cập nhật");
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("product_categories")
      .update(update)
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new ApiError(404, "Không tìm thấy danh mục");

    await writeAuditLog({
      actorId: session.userId,
      action: "category.update",
      entityType: "product_category",
      entityId: id,
      after: update,
    });
    return jsonOk({ category: data });
  } catch (e) {
    return handleApiError(e);
  }
}
