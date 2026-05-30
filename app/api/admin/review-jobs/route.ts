import { NextRequest, NextResponse } from "next/server";
import { requireApi } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { handleApiError, jsonOk } from "@/lib/http";
import { Constants } from "@/lib/database.types";
import type { Database } from "@/lib/database.types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const VALID = new Set<string>(Constants.public.Enums.video_review_job_status);

// GET /api/admin/review-jobs?status=...
export async function GET(req: NextRequest) {
  try {
    const guard = await requireApi(["admin"]);
    if (guard instanceof NextResponse) return guard;

    const sp = req.nextUrl.searchParams;
    const status = sp.get("status");
    const limit = Math.min(Number(sp.get("limit") ?? 200) || 200, 1000);

    const supabase = await createSupabaseServerClient();
    let query = supabase
      .from("video_review_jobs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (status && VALID.has(status)) {
      query = query.eq(
        "status",
        status as Database["public"]["Enums"]["video_review_job_status"],
      );
    }
    const { data, error } = await query;
    if (error) throw error;
    return jsonOk({ jobs: data ?? [] });
  } catch (e) {
    return handleApiError(e);
  }
}
