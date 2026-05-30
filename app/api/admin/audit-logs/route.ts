import { NextRequest, NextResponse } from "next/server";
import { requireApi } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { handleApiError, jsonOk } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/admin/audit-logs — chỉ admin.
export async function GET(req: NextRequest) {
  try {
    const guard = await requireApi(["admin"]);
    if (guard instanceof NextResponse) return guard;

    const sp = req.nextUrl.searchParams;
    const limit = Math.min(Number(sp.get("limit") ?? 200) || 200, 1000);

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("audit_logs")
      .select(
        "*, actor:profiles!audit_logs_actor_id_fkey(id,full_name,email)",
      )
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return jsonOk({ logs: data ?? [] });
  } catch (e) {
    return handleApiError(e);
  }
}
