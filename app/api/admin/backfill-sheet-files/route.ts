import { NextResponse } from "next/server";
import { requireApi } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { backfillFileLinks } from "@/lib/sheets";
import { writeAuditLog } from "@/lib/audit";
import { ApiError, handleApiError, jsonOk } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/admin/backfill-sheet-files
 * Điền link video Drive (từ DB) vào cột "File video" của Google Sheet cho các
 * dòng đang trống. Một lần / chạy lại tuỳ ý (idempotent). Admin-only.
 */
export async function POST() {
  try {
    const guard = await requireApi(["admin"]);
    if (guard instanceof NextResponse) return guard;
    const session = guard;

    const admin = createSupabaseAdminClient();
    const map = new Map<string, string>();
    const pageSize = 1000;
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await admin
        .from("video_submissions")
        .select("sub_id, drive_web_url, attachments")
        .range(from, from + pageSize - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      for (const row of data) {
        const subId = (row.sub_id ?? "").trim();
        if (!subId) continue;
        let link = (row.drive_web_url ?? "").trim();
        if (!link && Array.isArray(row.attachments)) {
          const vid = (
            row.attachments as Array<{ kind?: string; web_url?: string }>
          ).find((a) => a?.kind === "video");
          link = (vid?.web_url ?? "").trim();
        }
        if (link) map.set(subId, link);
      }
      if (data.length < pageSize) break;
    }

    const result = await backfillFileLinks(map);
    if (!result.ok) throw new ApiError(500, result.error ?? "Backfill thất bại");

    await writeAuditLog({
      actorId: session.userId,
      action: "sheet.backfill_files",
      entityType: "google_sheet",
      entityId: "file_video_column",
      after: {
        updated: result.updated,
        scanned: result.scanned,
        candidates: map.size,
      },
    });
    return jsonOk(result);
  } catch (e) {
    return handleApiError(e);
  }
}
