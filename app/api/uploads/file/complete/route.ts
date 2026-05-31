import { NextRequest, NextResponse } from "next/server";
import { requireApi } from "@/lib/auth/session";
import { finalizeOAuthDriveFile } from "@/lib/drive-oauth";
import { ApiError, handleApiError, jsonOk, readJson } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// POST /api/uploads/file/complete — chỉ dùng cho mode 'drive': cấp quyền + lấy link.
export async function POST(req: NextRequest) {
  try {
    const guard = await requireApi(["staff", "aggregator", "admin"]);
    if (guard instanceof NextResponse) return guard;

    const body = await readJson<{ fileId?: string }>(req);
    const fileId = (body.fileId ?? "").trim();
    if (!fileId) throw new ApiError(400, "Thiếu fileId");

    const meta = await finalizeOAuthDriveFile(fileId, req.nextUrl.origin);
    return jsonOk({ drive: meta });
  } catch (e) {
    return handleApiError(e);
  }
}
