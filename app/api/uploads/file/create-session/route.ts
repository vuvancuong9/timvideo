import { NextRequest, NextResponse } from "next/server";
import { requireApi } from "@/lib/auth/session";
import {
  isDriveOAuthConnected,
  createOAuthResumableSession,
} from "@/lib/drive-oauth";
import { writeAuditLog } from "@/lib/audit";
import { ApiError, handleApiError, jsonOk, readJson } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// POST /api/uploads/file/create-session
// File (video/ảnh) tải THẲNG lên Google Drive cá nhân — KHÔNG lưu Supabase Storage.
// Bắt buộc đã kết nối Drive OAuth; chưa kết nối → báo lỗi rõ (không fallback).
// accountant KHÔNG được upload.
export async function POST(req: NextRequest) {
  try {
    const guard = await requireApi(["staff", "aggregator", "admin"]);
    if (guard instanceof NextResponse) return guard;
    const session = guard;

    const body = await readJson<{
      fileName?: string;
      mimeType?: string;
      fileSize?: number;
      baseName?: string | null;
      index?: number;
    }>(req);
    const fileName = (body.fileName ?? "").trim();
    if (!fileName) throw new ApiError(400, "Thiếu tên file");

    if (!(await isDriveOAuthConnected())) {
      throw new ApiError(
        400,
        "Chưa kết nối Google Drive cá nhân. Video/ảnh phải tải thẳng lên Drive (không lưu Supabase). Vào /admin/settings → nhóm 'Google Drive (cá nhân)' để kết nối rồi thử lại.",
        "DRIVE_NOT_CONNECTED",
      );
    }
    const { uploadUrl, folderId } = await createOAuthResumableSession({
      fileName,
      mimeType: body.mimeType || "application/octet-stream",
      fileSize: body.fileSize,
      origin: req.nextUrl.origin,
    });
    await writeAuditLog({
      actorId: session.userId,
      action: "upload.create_session",
      entityType: "drive_oauth",
      after: { folderId },
    });
    return jsonOk({ mode: "drive", uploadUrl });
  } catch (e) {
    return handleApiError(e);
  }
}
