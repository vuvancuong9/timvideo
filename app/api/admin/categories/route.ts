import { NextRequest, NextResponse } from "next/server";
import { requireApi } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { writeAuditLog } from "@/lib/audit";
import { ApiError, handleApiError, jsonOk, readJson } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// POST /api/admin/categories — admin tạo danh mục.
export async function POST(req: NextRequest) {
  try {
    const guard = await requireApi(["admin"]);
    if (guard instanceof NextResponse) return guard;
    const session = guard;

    const body = await readJson<{ name?: string; description?: string }>(req);
    const name = (body.name ?? "").trim();
    if (!name) throw new ApiError(400, "Thiếu tên danh mục");

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("product_categories")
      .insert({ name, description: body.description?.trim() || null })
      .select("*")
      .single();
    if (error) throw error;

    await writeAuditLog({
      actorId: session.userId,
      action: "category.create",
      entityType: "product_category",
      entityId: data.id,
      after: data,
    });
    return jsonOk({ category: data }, { status: 201 });
  } catch (e) {
    return handleApiError(e);
  }
}
