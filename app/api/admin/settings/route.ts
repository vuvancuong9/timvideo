import { NextRequest, NextResponse } from "next/server";
import { requireApi } from "@/lib/auth/session";
import {
  getManagedSettingsStatus,
  setManagedSettings,
} from "@/lib/app-settings";
import { invalidateSettingsCache } from "@/lib/secrets";
import { writeAuditLog } from "@/lib/audit";
import { handleApiError, jsonOk, readJson } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/admin/settings — trạng thái cấu hình (secret đã che). CHỈ admin.
export async function GET() {
  try {
    const guard = await requireApi(["admin"]);
    if (guard instanceof NextResponse) return guard;
    const status = await getManagedSettingsStatus();
    return jsonOk(status);
  } catch (e) {
    return handleApiError(e);
  }
}

// PUT /api/admin/settings — cập nhật API key / config. CHỈ admin.
// Body: { values?: { KEY: "..." }, clear?: ["KEY"] }. Giá trị rỗng = giữ nguyên.
export async function PUT(req: NextRequest) {
  try {
    const guard = await requireApi(["admin"]);
    if (guard instanceof NextResponse) return guard;
    const session = guard;

    const body = await readJson<{
      values?: Record<string, unknown>;
      clear?: string[];
    }>(req);

    const result = await setManagedSettings(
      body.values ?? {},
      body.clear ?? [],
      session.userId,
    );

    // Áp dụng ngay (không chờ TTL 60s).
    invalidateSettingsCache();

    // Audit CHỈ ghi tên key, KHÔNG ghi giá trị secret.
    await writeAuditLog({
      actorId: session.userId,
      action: "settings.update",
      entityType: "app_settings",
      after: { updated: result.updated, cleared: result.cleared },
    });

    return jsonOk(result);
  } catch (e) {
    return handleApiError(e);
  }
}
