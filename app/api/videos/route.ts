import { NextRequest, NextResponse } from "next/server";
import { requireApi } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { canonicalizeVideo } from "@/lib/url/hash";
import { fetchVideos } from "@/lib/videos";
import { writeAuditLog } from "@/lib/audit";
import { ApiError, handleApiError, jsonOk, readJson } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type CreateBody = {
  shopee_product_url?: string;
  product_price?: number | string;
  commission_percent?: number | string;
  video_url?: string;
  category_id?: string | null;
  staff_note?: string | null;
  drive?: {
    driveFileId?: string | null;
    driveFileName?: string | null;
    driveWebUrl?: string | null;
    driveFolderId?: string | null;
  } | null;
};

// POST /api/videos — staff (hoặc admin) tạo video. Chống trùng ở DB (unique).
export async function POST(req: NextRequest) {
  try {
    const guard = await requireApi(["staff", "admin"]);
    if (guard instanceof NextResponse) return guard;
    const session = guard;

    const body = await readJson<CreateBody>(req);
    const shopeeUrl = (body.shopee_product_url ?? "").trim();
    const videoUrl = (body.video_url ?? "").trim();
    if (!shopeeUrl) throw new ApiError(400, "Thiếu link sản phẩm Shopee");
    if (!videoUrl) throw new ApiError(400, "Thiếu link video");

    const price = Number(body.product_price);
    const pct = Number(body.commission_percent);
    if (!Number.isFinite(price) || price < 0) {
      throw new ApiError(400, "Giá sản phẩm không hợp lệ");
    }
    if (!Number.isFinite(pct) || pct < 0) {
      throw new ApiError(400, "% hoa hồng không hợp lệ");
    }

    const { canonicalUrl, hash, source } = canonicalizeVideo(videoUrl);
    const estimated = Math.round(price * pct) / 100; // = price * pct / 100, 2 chữ số thập phân

    const insert = {
      created_by: session.userId,
      shopee_product_url: shopeeUrl,
      product_price: price,
      commission_percent: pct,
      estimated_commission: estimated,
      video_source: source,
      video_url: videoUrl,
      canonical_video_url: canonicalUrl,
      canonical_video_hash: hash,
      category_id: body.category_id || null,
      drive_file_id: body.drive?.driveFileId ?? null,
      drive_file_name: body.drive?.driveFileName ?? null,
      drive_web_url: body.drive?.driveWebUrl ?? null,
      drive_folder_id: body.drive?.driveFolderId ?? null,
      staff_note: (body.staff_note ?? "").trim() || null,
      status: "submitted" as const,
    };

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("video_submissions")
      .insert(insert)
      .select("id")
      .single();

    if (error) {
      if ((error as { code?: string }).code === "23505") {
        throw new ApiError(409, "Video này đã tồn tại trong hệ thống", "DUPLICATE");
      }
      throw error;
    }

    await writeAuditLog({
      actorId: session.userId,
      action: "video.create",
      entityType: "video_submission",
      entityId: data.id,
      after: {
        canonical_video_url: canonicalUrl,
        video_source: source,
        status: "submitted",
      },
    });

    return jsonOk({ id: data.id }, { status: 201 });
  } catch (e) {
    return handleApiError(e);
  }
}

// GET /api/videos — danh sách (RLS tự lọc theo role).
export async function GET(req: NextRequest) {
  try {
    const guard = await requireApi();
    if (guard instanceof NextResponse) return guard;

    const sp = req.nextUrl.searchParams;
    const supabase = await createSupabaseServerClient();
    const { rows, count } = await fetchVideos(supabase, {
      status: sp.get("status"),
      source: sp.get("source"),
      categoryId: sp.get("category_id"),
      employeeId: sp.get("employee_id"),
      assigned: (sp.get("assigned") as "assigned" | "unassigned" | null) ?? null,
      q: sp.get("q"),
      limit: sp.get("limit") ? Number(sp.get("limit")) : undefined,
      offset: sp.get("offset") ? Number(sp.get("offset")) : undefined,
    });
    return jsonOk({ videos: rows, count });
  } catch (e) {
    return handleApiError(e);
  }
}
