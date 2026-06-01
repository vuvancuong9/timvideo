import { NextRequest, NextResponse } from "next/server";
import { requireApi } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { writeAuditLog } from "@/lib/audit";
import { ApiError, handleApiError, jsonOk, readJson } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/facebook-pages?accountId=... — danh sách page của 1 tài khoản
// (hoặc bỏ accountId = tất cả). Xem: accountant/aggregator/admin.
export async function GET(req: NextRequest) {
  try {
    const guard = await requireApi(["accountant", "aggregator", "admin"]);
    if (guard instanceof NextResponse) return guard;

    const accountId = req.nextUrl.searchParams.get("accountId");
    const supabase = await createSupabaseServerClient();
    let query = supabase
      .from("facebook_pages")
      .select("*")
      .order("created_at", { ascending: true });
    if (accountId) query = query.eq("affiliate_account_id", accountId);
    const { data, error } = await query;
    if (error) throw error;
    return jsonOk({ pages: data ?? [] });
  } catch (e) {
    return handleApiError(e);
  }
}

// POST /api/facebook-pages — thêm Facebook Page. CHỈ admin + aggregator (tổng hợp).
// Body: { affiliate_account_id, name, url?, note? }
export async function POST(req: NextRequest) {
  try {
    const guard = await requireApi(["aggregator", "admin"]);
    if (guard instanceof NextResponse) return guard;
    const session = guard;

    const body = await readJson<{
      affiliate_account_id?: string;
      name?: string;
      url?: string;
      note?: string;
    }>(req);

    const accountId = (body.affiliate_account_id ?? "").trim();
    const name = (body.name ?? "").trim();
    if (!accountId) throw new ApiError(400, "Thiếu tài khoản affiliate");
    if (!name) throw new ApiError(400, "Thiếu tên Page");

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("facebook_pages")
      .insert({
        affiliate_account_id: accountId,
        name,
        url: body.url?.trim() || null,
        note: body.note?.trim() || null,
        created_by: session.userId,
      })
      .select("*")
      .single();
    if (error) throw error;

    await writeAuditLog({
      actorId: session.userId,
      action: "facebook_page.create",
      entityType: "facebook_page",
      entityId: data.id,
      after: data,
    });
    return jsonOk({ page: data }, { status: 201 });
  } catch (e) {
    return handleApiError(e);
  }
}
