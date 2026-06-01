import { NextRequest, NextResponse } from "next/server";
import { requireApi } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { writeAuditLog } from "@/lib/audit";
import { ApiError, handleApiError, jsonOk, readJson } from "@/lib/http";
import type { Database } from "@/lib/database.types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PageUpdate = Database["public"]["Tables"]["facebook_pages"]["Update"];

// PATCH /api/facebook-pages/:id — sửa Page. CHỈ admin + aggregator.
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
      name?: string;
      url?: string | null;
      note?: string | null;
      is_active?: boolean;
    }>(req);

    const update: PageUpdate = { updated_at: new Date().toISOString() };
    if (body.name !== undefined) update.name = body.name.trim();
    if (body.url !== undefined) update.url = body.url?.trim() || null;
    if (body.note !== undefined) update.note = body.note?.trim() || null;
    if (body.is_active !== undefined) update.is_active = body.is_active;

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("facebook_pages")
      .update(update)
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new ApiError(404, "Không tìm thấy Page");

    await writeAuditLog({
      actorId: session.userId,
      action: "facebook_page.update",
      entityType: "facebook_page",
      entityId: id,
      after: update,
    });
    return jsonOk({ page: data });
  } catch (e) {
    return handleApiError(e);
  }
}

// DELETE /api/facebook-pages/:id — xóa Page. CHỈ admin + aggregator.
export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await requireApi(["aggregator", "admin"]);
    if (guard instanceof NextResponse) return guard;
    const session = guard;
    const { id } = await ctx.params;

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .from("facebook_pages")
      .delete()
      .eq("id", id);
    if (error) throw error;

    await writeAuditLog({
      actorId: session.userId,
      action: "facebook_page.delete",
      entityType: "facebook_page",
      entityId: id,
    });
    return jsonOk({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
