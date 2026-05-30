import { NextRequest, NextResponse } from "next/server";
import { requireApi } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { handleApiError, jsonOk } from "@/lib/http";

export const dynamic = "force-dynamic";

// GET /api/accounting/sales — doanh số toàn bộ nhân viên (kế toán/admin, read-only).
export async function GET(req: NextRequest) {
  try {
    const guard = await requireApi(["accountant", "admin"]);
    if (guard instanceof NextResponse) return guard;

    const sp = req.nextUrl.searchParams;
    const supabase = await createSupabaseServerClient();
    let query = supabase
      .from("sales_records")
      .select(
        "*, employee:profiles!sales_records_employee_id_fkey(id,full_name,email)",
      )
      .order("date", { ascending: false });
    const from = sp.get("from");
    const to = sp.get("to");
    const employeeId = sp.get("employee_id");
    if (from) query = query.gte("date", from);
    if (to) query = query.lte("date", to);
    if (employeeId) query = query.eq("employee_id", employeeId);

    const { data, error } = await query;
    if (error) throw error;
    return jsonOk({ sales: data ?? [] });
  } catch (e) {
    return handleApiError(e);
  }
}
