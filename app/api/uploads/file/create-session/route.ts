import { NextRequest, NextResponse } from "next/server";
import { requireApi } from "@/lib/auth/session";
import { createSignedVideoUpload } from "@/lib/storage";
import {
  isDriveOAuthConnected,
  createOAuthResumableSession,
} from "@/lib/drive-oauth";
import { writeAuditLog } from "@/lib/audit";
import { ApiError, handleApiError, jsonOk, readJson } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// POST /api/uploads/file/create-session
// Trả 'drive' nếu admin đã kết nối Google Drive cá nhân; nếu chưa, fallback 'storage'.
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

    if (await isDriveOAuthConnected()) {
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
    }

    // Fallback: Supabase Storage
    const signed = await createSignedVideoUpload({
      userId: session.userId,
      fileName,
      baseName: body.baseName ?? null,
      index: body.index,
    });
    await writeAuditLog({
      actorId: session.userId,
      action: "upload.create_session",
      entityType: "storage_upload",
      after: { path: signed.path },
    });
    return jsonOk({ mode: "storage", ...signed });
  } catch (e) {
    return handleApiError(e);
  }
}
