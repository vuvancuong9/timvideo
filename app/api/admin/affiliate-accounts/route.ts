import { NextRequest, NextResponse } from "next/server";
import { requireApi } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { writeAuditLog } from "@/lib/audit";
import { ApiError, handleApiError, jsonOk, readJson } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// POST /api/admin/affiliate-accounts — admin tạo tài khoản affiliate.
export async function POST(req: NextRequest) {
  try {
    const guard = await requireApi(["admin"]);
    if (guard instanceof NextResponse) return guard;
    const session = guard;

    const body = await readJson<{
      code?: string;
      name?: string;
      platform?: string;
      note?: string;
    }>(req);
    const code = (body.code ?? "").trim();
    const name = (body.name ?? "").trim();
    if (!code) throw new ApiError(400, "Thiếu mã tài khoản (code)");
    if (!name) throw new ApiError(400, "Thiếu tên tài khoản");

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("affiliate_accounts")
      .insert({
        code,
        name,
        platform: body.platform?.trim() || "shopee",
        note: body.note?.trim() || null,
      })
      .select("*")
      .single();
    if (error) throw error;

    await writeAuditLog({
      actorId: session.userId,
      action: "affiliate_account.create",
      entityType: "affiliate_account",
      entityId: data.id,
      after: data,
    });
    return jsonOk({ affiliateAccount: data }, { status: 201 });
  } catch (e) {
    return handleApiError(e);
  }
}
