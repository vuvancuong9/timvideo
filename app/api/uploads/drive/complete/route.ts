import { NextRequest, NextResponse } from "next/server";
import { requireApi } from "@/lib/auth/session";
import { finalizeDriveFile } from "@/lib/drive";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { writeAuditLog } from "@/lib/audit";
import { ApiError, handleApiError, jsonOk, readJson } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// POST /api/uploads/drive/complete — cấp quyền xem theo link + lấy metadata.
// Nếu kèm submissionId: cập nhật metadata Drive vào submission đó (theo RLS).
export async function POST(req: NextRequest) {
  try {
    const guard = await requireApi(["staff", "aggregator", "admin"]);
    if (guard instanceof NextResponse) return guard;
    const session = guard;

    const body = await readJson<{ fileId?: string; submissionId?: string }>(req);
    const fileId = (body.fileId ?? "").trim();
    if (!fileId) throw new ApiError(400, "Thiếu fileId");

    const meta = await finalizeDriveFile(fileId);

    if (body.submissionId) {
      const supabase = await createSupabaseServerClient();
      const { error } = await supabase
        .from("video_submissions")
        .update({
          drive_file_id: meta.driveFileId,
          drive_file_name: meta.driveFileName,
          drive_web_url: meta.driveWebUrl,
          drive_folder_id: meta.driveFolderId,
        })
        .eq("id", body.submissionId);
      if (error) throw error;
    }

    await writeAuditLog({
      actorId: session.userId,
      action: "drive.upload_completed",
      entityType: "drive_upload",
      entityId: body.submissionId ?? null,
      after: meta,
    });

    return jsonOk({ drive: meta });
  } catch (e) {
    return handleApiError(e);
  }
}
