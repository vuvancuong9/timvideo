import { NextRequest, NextResponse } from "next/server";
import { requireApi } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { handleApiError, jsonOk } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/sales/my — doanh số của chính người đăng nhập.
export async function GET(req: NextRequest) {
  try {
    const guard = await requireApi();
    if (guard instanceof NextResponse) return guard;
    const session = guard;

    const sp = req.nextUrl.searchParams;
    const supabase = await createSupabaseServerClient();
    let query = supabase
      .from("sales_records")
      .select("*")
      .eq("employee_id", session.userId)
      .order("date", { ascending: false });
    const from = sp.get("from");
    const to = sp.get("to");
    if (from) query = query.gte("date", from);
    if (to) query = query.lte("date", to);

    const { data, error } = await query;
    if (error) throw error;
    return jsonOk({ sales: data ?? [] });
  } catch (e) {
    return handleApiError(e);
  }
}
