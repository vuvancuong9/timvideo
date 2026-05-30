import { redirect } from "next/navigation";
import type { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { jsonError } from "@/lib/http";
import type { UserRole } from "@/lib/constants";
import type { Database } from "@/lib/database.types";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export type SessionContext = {
  userId: string;
  email: string;
  role: UserRole;
  profile: Profile;
};

function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Lấy/khởi tạo profile cho user. Tự nâng quyền admin nếu email nằm trong
 * ADMIN_EMAILS (dùng service role để vượt RLS/trigger một cách có kiểm soát).
 */
async function getOrCreateProfile(
  supabase: SupabaseClient<Database>,
  userId: string,
  email: string,
): Promise<Profile | null> {
  const { data: existing } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  const isAdminEmail = adminEmails().includes(email.toLowerCase());

  if (existing) {
    if (isAdminEmail && existing.role !== "admin") {
      const admin = createSupabaseAdminClient();
      const { data } = await admin
        .from("profiles")
        .update({ role: "admin" })
        .eq("id", userId)
        .select("*")
        .single();
      return data ?? existing;
    }
    return existing;
  }

  // Chưa có profile (vd: user tạo qua dashboard nhưng trigger chưa chạy) -> tạo mới.
  const admin = createSupabaseAdminClient();
  const { data: created, error } = await admin
    .from("profiles")
    .upsert(
      {
        id: userId,
        email,
        role: isAdminEmail ? "admin" : "staff",
      },
      { onConflict: "id" },
    )
    .select("*")
    .single();

  if (error) {
    console.error("[auth] getOrCreateProfile failed:", error);
    return null;
  }
  return created;
}

/** Trả về phiên đăng nhập hiện tại hoặc null (không redirect). */
export async function getOptionalSession(): Promise<SessionContext | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const email = user.email ?? "";
  const profile = await getOrCreateProfile(supabase, user.id, email);
  if (!profile || !profile.is_active) return null;

  return { userId: user.id, email, role: profile.role, profile };
}

/** Bắt buộc đăng nhập (cho Server Components / pages). */
export async function requireSession(): Promise<SessionContext> {
  const session = await getOptionalSession();
  if (!session) redirect("/login");
  return session;
}

/** Bắt buộc đăng nhập + thuộc 1 trong các role (admin luôn được phép). */
export async function requireRole(roles: UserRole[]): Promise<SessionContext> {
  const session = await requireSession();
  if (session.role !== "admin" && !roles.includes(session.role)) {
    redirect("/unauthorized");
  }
  return session;
}

/**
 * Guard cho API route. Trả về SessionContext nếu hợp lệ, hoặc NextResponse lỗi.
 * Dùng: const s = await requireApi([...]); if (s instanceof NextResponse) return s;
 * - roles undefined  => chỉ cần đăng nhập (RLS lo phần phân quyền dữ liệu).
 * - admin luôn vượt qua.
 */
export async function requireApi(
  roles?: UserRole[],
): Promise<SessionContext | NextResponse> {
  const session = await getOptionalSession();
  if (!session) {
    return jsonError(401, "Chưa đăng nhập", "UNAUTHENTICATED");
  }
  if (roles && session.role !== "admin" && !roles.includes(session.role)) {
    return jsonError(403, "Bạn không có quyền thực hiện thao tác này", "FORBIDDEN");
  }
  return session;
}
