import { NextRequest, NextResponse } from "next/server";
import { requireApi } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { writeAuditLog } from "@/lib/audit";
import { ApiError, handleApiError, jsonOk, readJson } from "@/lib/http";
import { Constants, type Database } from "@/lib/database.types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const VALID_ROLES = new Set<string>(Constants.public.Enums.user_role);

// GET /api/admin/users — danh sách người dùng (accountant/aggregator/admin xem được).
export async function GET() {
  try {
    const guard = await requireApi(["accountant", "aggregator", "admin"]);
    if (guard instanceof NextResponse) return guard;
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("id,email,full_name,role,is_active,created_at")
      .order("created_at", { ascending: true });
    if (error) throw error;
    return jsonOk({ users: data ?? [] });
  } catch (e) {
    return handleApiError(e);
  }
}

// POST /api/admin/users — CHỈ admin: tạo tài khoản nhân viên mới.
// Body: { email, password, full_name, role }. Email confirm luôn (đăng nhập ngay).
export async function POST(req: NextRequest) {
  try {
    const guard = await requireApi(["admin"]);
    if (guard instanceof NextResponse) return guard;
    const session = guard;

    const body = await readJson<{
      email?: string;
      password?: string;
      full_name?: string;
      role?: string;
    }>(req);

    const email = (body.email ?? "").trim().toLowerCase();
    const password = body.password ?? "";
    const fullName = (body.full_name ?? "").trim();
    const role = body.role ?? "staff";

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new ApiError(400, "Email không hợp lệ");
    }
    if (password.length < 6) {
      throw new ApiError(400, "Mật khẩu phải có ít nhất 6 ký tự");
    }
    if (!fullName) {
      throw new ApiError(400, "Thiếu họ tên");
    }
    if (!VALID_ROLES.has(role)) {
      throw new ApiError(400, "Quyền không hợp lệ");
    }

    const admin = createSupabaseAdminClient();

    // Tạo auth user (xác nhận email luôn để đăng nhập được ngay).
    const { data: created, error: createErr } =
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });
    if (createErr || !created.user) {
      // Email trùng → Supabase trả lỗi rõ ràng.
      const msg = createErr?.message ?? "Không tạo được tài khoản";
      const dup = /already|registered|exist/i.test(msg);
      throw new ApiError(
        dup ? 409 : 400,
        dup ? "Email này đã có tài khoản" : msg,
        dup ? "DUPLICATE_EMAIL" : undefined,
      );
    }

    const userId = created.user.id;

    // Trigger handle_new_user đã tạo profile (full_name từ metadata). Set role +
    // bảo đảm full_name đúng (phòng trường hợp trigger không lấy được metadata).
    const { error: updErr } = await admin
      .from("profiles")
      .update({
        role: role as Database["public"]["Enums"]["user_role"],
        full_name: fullName,
      })
      .eq("id", userId);
    if (updErr) throw updErr;

    await writeAuditLog({
      actorId: session.userId,
      action: "user.create",
      entityType: "profile",
      entityId: userId,
      after: { email, role, full_name: fullName },
    });

    return jsonOk({ id: userId, email, role, full_name: fullName }, { status: 201 });
  } catch (e) {
    return handleApiError(e);
  }
}
