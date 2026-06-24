import { NextResponse } from "next/server";
import { requireApi } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  listSheetSubIds,
  appendSubmissionRows,
  type SubmissionSheetRow,
} from "@/lib/sheets";
import { SOURCE_TYPE_LABELS } from "@/lib/video-intake/labels";
import { writeAuditLog } from "@/lib/audit";
import { ApiError, handleApiError, jsonOk } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function vnDate(iso: string): string {
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(iso));
}

/**
 * POST /api/admin/backfill-missing-rows
 * Ghi BÙ vào Google Sheet các submission đang có trong DB nhưng THIẾU trong
 * Sheet (vd: lúc service account mất quyền ghi). Append đúng thứ tự thời gian,
 * không đụng dòng đã có. Admin-only, idempotent.
 */
export async function POST() {
  try {
    const guard = await requireApi(["admin"]);
    if (guard instanceof NextResponse) return guard;
    const session = guard;

    const existing = await listSheetSubIds();
    if (!existing) throw new ApiError(500, "Chưa cấu hình Sheet / credential");

    const admin = createSupabaseAdminClient();
    const missing: SubmissionSheetRow[] = [];
    const pageSize = 1000;
    let total = 0;
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await admin
        .from("video_submissions")
        .select(
          "sub_id, product_name, created_at, shopee_product_url, product_price, commission_percent, source_type, original_video_url, drive_web_url, attachments, creator:profiles!video_submissions_created_by_fkey(full_name,email), category:product_categories(name)",
        )
        .order("created_at", { ascending: true })
        .range(from, from + pageSize - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      total += data.length;
      for (const row of data) {
        const subId = (row.sub_id ?? "").trim();
        if (!subId || existing.has(subId)) continue;

        const price = Number(row.product_price) || 0;
        const pct = Number(row.commission_percent) || 0;
        const creator = row.creator as {
          full_name: string | null;
          email: string;
        } | null;
        const category = row.category as { name: string } | null;
        let fileUrl = (row.drive_web_url ?? "").trim();
        if (!fileUrl && Array.isArray(row.attachments)) {
          const vid = (
            row.attachments as Array<{ kind?: string; web_url?: string }>
          ).find((a) => a?.kind === "video");
          fileUrl = (vid?.web_url ?? "").trim();
        }

        missing.push({
          subId,
          productName: row.product_name ?? "",
          date: vnDate(row.created_at),
          employee: creator?.full_name || creator?.email || "",
          shopeeUrl: row.shopee_product_url ?? "",
          price,
          commissionPercent: pct,
          estimatedCommission: Math.round((price * pct) / 100),
          category: category?.name ?? "",
          source: SOURCE_TYPE_LABELS[row.source_type] ?? row.source_type ?? "",
          videoUrl: row.original_video_url ?? "",
          fileUrl,
          status: "Chờ chấm",
        });
      }
      if (data.length < pageSize) break;
    }

    const result = await appendSubmissionRows(missing);
    if (!result.ok) throw new ApiError(500, result.error ?? "Ghi bù thất bại");

    await writeAuditLog({
      actorId: session.userId,
      action: "sheet.backfill_missing_rows",
      entityType: "google_sheet",
      entityId: "missing_submissions",
      after: { appended: result.appended, scanned: total },
    });
    return jsonOk({
      ok: true,
      appended: result.appended,
      scanned: total,
      message: `Đã ghi bù ${result.appended} submission còn thiếu vào Sheet (quét ${total} dòng DB).`,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
