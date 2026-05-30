import { NextResponse } from "next/server";
import { requireApi } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { handleApiError, jsonOk } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // staff không được xem affiliate accounts.
    const guard = await requireApi(["accountant", "aggregator", "admin"]);
    if (guard instanceof NextResponse) return guard;
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("affiliate_accounts")
      .select("*")
      .order("code");
    if (error) throw error;
    return jsonOk({ affiliateAccounts: data ?? [] });
  } catch (e) {
    return handleApiError(e);
  }
}
