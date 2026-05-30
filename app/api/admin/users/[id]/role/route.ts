import { NextRequest, NextResponse } from "next/server";
import { requireApi } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { writeAuditLog } from "@/lib/audit";
import { ApiError, handleApiError, jsonOk, readJson } from "@/lib/http";
import { Constants, type Database } from "@/lib/database.types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const VALID_ROLES = new Set<string>(Constants.public.Enums.user_role);

// PATCH /api/admin/users/:id/role — CHỈ admin đổi quyền.
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await requireApi(["admin"]);
    if (guard instanceof NextResponse) return guard;
    const session = guard;
    const { id } = await ctx.params;

    const body = await readJson<{ role?: string }>(req);
    if (!body.role || !VALID_ROLES.has(body.role)) {
      throw new ApiError(400, "Role không hợp lệ");
    }
    if (id === session.userId && body.role !== "admin") {
      throw new ApiError(400, "Không thể tự hạ quyền admin của chính bạn");
    }

    const supabase = await createSupabaseServerClient();
    const { data: before } = await supabase
      .from("profiles")
      .select("id,email,role")
      .eq("id", id)
      .maybeSingle();
    if (!before) throw new ApiError(404, "Không tìm thấy người dùng");

    const { error } = await supabase
      .from("profiles")
      .update({
        role: body.role as Database["public"]["Enums"]["user_role"],
      })
      .eq("id", id);
    if (error) throw error;

    await writeAuditLog({
      actorId: session.userId,
      action: "user.role_change",
      entityType: "profile",
      entityId: id,
      before: { role: before.role },
      after: { role: body.role },
    });

    return jsonOk({ id, role: body.role });
  } catch (e) {
    return handleApiError(e);
  }
}
