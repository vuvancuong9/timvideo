import { NextResponse } from "next/server";
import { requireApi } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { handleApiError, jsonOk } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const guard = await requireApi();
    if (guard instanceof NextResponse) return guard;
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("product_categories")
      .select("id,name,description,is_active")
      .order("name");
    if (error) throw error;
    return jsonOk({ categories: data ?? [] });
  } catch (e) {
    return handleApiError(e);
  }
}
