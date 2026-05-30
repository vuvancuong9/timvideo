import { NextRequest, NextResponse } from "next/server";
import { requireApi } from "@/lib/auth/session";
import { createResumableUploadSession } from "@/lib/drive";
import { writeAuditLog } from "@/lib/audit";
import { ApiError, handleApiError, jsonOk, readJson } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// POST /api/uploads/drive/create-session
// accountant KHÔNG được upload. Trả về resumable uploadUrl để client PUT thẳng lên Google.
export async function POST(req: NextRequest) {
  try {
    const guard = await requireApi(["staff", "aggregator", "admin"]);
    if (guard instanceof NextResponse) return guard;
    const session = guard;

    const body = await readJson<{
      fileName?: string;
      mimeType?: string;
      fileSize?: number;
    }>(req);
    const fileName = (body.fileName ?? "").trim();
    if (!fileName) throw new ApiError(400, "Thiếu tên file");

    const { uploadUrl, folderId } = await createResumableUploadSession({
      fileName,
      mimeType: body.mimeType || "application/octet-stream",
      fileSize: body.fileSize,
    });

    await writeAuditLog({
      actorId: session.userId,
      action: "drive.create_session",
      entityType: "drive_upload",
      after: { fileName, folderId },
    });

    return jsonOk({ uploadUrl, folderId, fileName });
  } catch (e) {
    return handleApiError(e);
  }
}
