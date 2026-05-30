import { NextRequest, NextResponse } from "next/server";
import { requireApi } from "@/lib/auth/session";
import { checkDuplicateByUrl } from "@/lib/video-intake/duplicate";
import { handleApiError, jsonOk } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/video-intake/check-duplicate?url=...
export async function GET(req: NextRequest) {
  try {
    const guard = await requireApi();
    if (guard instanceof NextResponse) return guard;

    const url = req.nextUrl.searchParams.get("url") ?? "";
    if (!url.trim()) {
      return jsonOk({
        ok: true,
        duplicate: false,
        canonical_video_url: "",
        canonical_video_hash: "",
        source_type: "other_url",
      });
    }
    const result = await checkDuplicateByUrl(url);
    return jsonOk(result);
  } catch (e) {
    return handleApiError(e);
  }
}
