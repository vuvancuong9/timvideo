import { NextResponse } from "next/server";
import { requireApi } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { handleApiError, jsonOk } from "@/lib/http";

export const dynamic = "force-dynamic";

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
