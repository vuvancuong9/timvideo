import { NextRequest, NextResponse } from "next/server";
import { requireApi } from "@/lib/auth/session";
import { getThresholds, saveThresholds } from "@/lib/video-review/policy-config";
import { writeAuditLog } from "@/lib/audit";
import { handleApiError, jsonOk, readJson } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/admin/policy-rules — ngưỡng quyết định hiện hành. CHỈ admin.
export async function GET() {
  try {
    const guard = await requireApi(["admin"]);
    if (guard instanceof NextResponse) return guard;
    const thresholds = await getThresholds();
    return jsonOk({ thresholds });
  } catch (e) {
    return handleApiError(e);
  }
}

// PUT /api/admin/policy-rules — cập nhật ngưỡng quyết định. CHỈ admin.
export async function PUT(req: NextRequest) {
  try {
    const guard = await requireApi(["admin"]);
    if (guard instanceof NextResponse) return guard;
    const session = guard;

    const body = await readJson<Record<string, unknown>>(req);
    const saved = await saveThresholds(body, session.userId);

    await writeAuditLog({
      actorId: session.userId,
      action: "policy_rules.update",
      entityType: "app_settings",
      after: saved,
    });

    return jsonOk({ thresholds: saved });
  } catch (e) {
    return handleApiError(e);
  }
}
