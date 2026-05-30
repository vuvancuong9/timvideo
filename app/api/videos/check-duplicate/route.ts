import { NextRequest, NextResponse } from "next/server";
import { requireApi } from "@/lib/auth/session";
import { canonicalizeVideo } from "@/lib/url/hash";
import { handleApiError, jsonOk } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Kiểm tra trùng video TOÀN HỆ THỐNG (dùng service role để vượt RLS) nhưng
 * chỉ trả về boolean + canonical, KHÔNG lộ dữ liệu của nhân viên khác.
 */
export async function GET(req: NextRequest) {
  try {
    const guard = await requireApi();
    if (guard instanceof NextResponse) return guard;

    const url = req.nextUrl.searchParams.get("url") ?? "";
    if (!url.trim()) {
      return jsonOk({ duplicate: false, canonicalUrl: null, source: null });
    }

    const { canonicalUrl, hash, source } = canonicalizeVideo(url);
    const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("video_submissions")
      .select("id")
      .eq("canonical_video_hash", hash)
      .limit(1)
      .maybeSingle();
    if (error) throw error;

    return jsonOk({ duplicate: !!data, canonicalUrl, source });
  } catch (e) {
    return handleApiError(e);
  }
}
