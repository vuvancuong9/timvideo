import { NextRequest, NextResponse } from "next/server";
import { requireApi } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { scoreVideoPreview } from "@/lib/video-review/score-preview";
import { writeAuditLog } from "@/lib/audit";
import { ApiError, handleApiError, jsonOk, readJson } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Chấm điểm đồng bộ gọi 3 lần AI -> cần thời gian. Soft cap 60s (như cron).
export const maxDuration = 60;

import type { SubmissionAttachment } from "@/types/videoIntake";

type PreviewBody = {
  shopee_product_url?: string;
  product_price?: number | string;
  commission_percent?: number | string;
  category_id?: string | null;
  source_type?: string;
  original_video_url?: string | null;
  drive?: { driveWebUrl?: string | null; driveFileId?: string | null } | null;
  attachments?: SubmissionAttachment[] | null;
};

// POST /api/video-review/preview — chấm điểm thử NGAY (không lưu DB).
// staff/aggregator/admin được dùng; accountant không.
export async function POST(req: NextRequest) {
  try {
    const guard = await requireApi(["staff", "aggregator", "admin"]);
    if (guard instanceof NextResponse) return guard;
    const session = guard;

    const body = await readJson<PreviewBody>(req);
    const videoUrl = (body.original_video_url ?? "").trim() || null;
    // File video upload: Storage trả driveWebUrl (driveFileId=null), Drive cũ trả driveFileId.
    const hasVideoFile = Boolean(
      body.drive?.driveFileId || body.drive?.driveWebUrl,
    );
    const hasImages = (body.attachments ?? []).some((a) => a?.kind === "image");
    if (!videoUrl && !hasVideoFile && !hasImages) {
      throw new ApiError(
        400,
        "Cần dán link video hoặc upload file để chấm điểm thử",
      );
    }

    let categoryName: string | null = null;
    if (body.category_id) {
      const supabase = await createSupabaseServerClient();
      const { data } = await supabase
        .from("product_categories")
        .select("name")
        .eq("id", body.category_id)
        .maybeSingle();
      categoryName = data?.name ?? null;
    }

    const preview = await scoreVideoPreview({
      shopeeProductUrl: (body.shopee_product_url ?? "").trim(),
      productPrice: Number(body.product_price) || 0,
      commissionPercent: Number(body.commission_percent) || 0,
      categoryName,
      sourceType: body.source_type ?? "other_url",
      videoUrl,
      driveWebUrl: body.drive?.driveWebUrl ?? null,
      hasVideoFile,
      attachments: body.attachments ?? null,
    });

    await writeAuditLog({
      actorId: session.userId,
      action: "review.preview",
      entityType: "video_preview",
      after: { final_action: preview.decision.final_action },
    });

    return jsonOk({ preview });
  } catch (e) {
    return handleApiError(e);
  }
}
