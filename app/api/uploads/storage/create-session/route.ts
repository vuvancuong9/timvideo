import { NextRequest, NextResponse } from "next/server";
import { requireApi } from "@/lib/auth/session";
import { createSignedVideoUpload } from "@/lib/storage";
import { writeAuditLog } from "@/lib/audit";
import { ApiError, handleApiError, jsonOk, readJson } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// POST /api/uploads/storage/create-session
// accountant KHÔNG được upload. Trả signed upload URL + publicUrl.
export async function POST(req: NextRequest) {
  try {
    const guard = await requireApi(["staff", "aggregator", "admin"]);
    if (guard instanceof NextResponse) return guard;
    const session = guard;

    const body = await readJson<{
      fileName?: string;
      baseName?: string | null;
      index?: number;
    }>(req);
    const fileName = (body.fileName ?? "").trim();
    if (!fileName) throw new ApiError(400, "Thiếu tên file");

    const signed = await createSignedVideoUpload({
      userId: session.userId,
      fileName,
      baseName: body.baseName ?? null,
      index: body.index,
    });

    await writeAuditLog({
      actorId: session.userId,
      action: "storage.create_session",
      entityType: "storage_upload",
      after: { path: signed.path },
    });

    return jsonOk(signed);
  } catch (e) {
    return handleApiError(e);
  }
}
