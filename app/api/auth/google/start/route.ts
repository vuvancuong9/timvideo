import { NextRequest, NextResponse } from "next/server";
import { requireApi } from "@/lib/auth/session";
import { buildConsentUrl } from "@/lib/drive-oauth";
import { handleApiError } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/auth/google/start — admin bắt đầu kết nối Drive cá nhân.
export async function GET(req: NextRequest) {
  try {
    const guard = await requireApi(["admin"]);
    if (guard instanceof NextResponse) return guard;
    const origin = req.nextUrl.origin;
    const url = await buildConsentUrl(origin);
    return NextResponse.redirect(url);
  } catch (e) {
    return handleApiError(e);
  }
}
