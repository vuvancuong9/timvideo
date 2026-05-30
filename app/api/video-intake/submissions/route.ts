import { NextRequest, NextResponse } from "next/server";
import { requireApi } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSubmissionWithJob } from "@/lib/video-intake/submission-service";
import { fetchSubmissions } from "@/lib/video-intake/queries";
import { handleApiError, jsonOk, readJson } from "@/lib/http";
import { Constants } from "@/lib/database.types";
import type { CreateSubmissionInput } from "@/types/videoIntake";
import type {
  VideoSourceType,
  VideoSubmissionStatus,
} from "@/types/videoIntake";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const VALID_SOURCE = new Set<string>(Constants.public.Enums.video_source_type);

// POST /api/video-intake/submissions — staff/aggregator/admin (accountant KHÔNG).
// KHÔNG gọi AI ở đây — chỉ tạo submission + review job queued.
export async function POST(req: NextRequest) {
  try {
    const guard = await requireApi(["staff", "aggregator", "admin"]);
    if (guard instanceof NextResponse) return guard;
    const session = guard;

    const body = await readJson<CreateSubmissionInput>(req);
    if (!body.source_type || !VALID_SOURCE.has(body.source_type)) {
      return jsonOk({ error: "Nguồn video không hợp lệ" }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();
    const result = await createSubmissionWithJob(supabase, session.userId, body);
    return jsonOk(result, { status: 201 });
  } catch (e) {
    return handleApiError(e);
  }
}

// GET /api/video-intake/submissions — RLS tự lọc theo role.
export async function GET(req: NextRequest) {
  try {
    const guard = await requireApi();
    if (guard instanceof NextResponse) return guard;

    const sp = req.nextUrl.searchParams;
    const supabase = await createSupabaseServerClient();
    const { rows, count } = await fetchSubmissions(supabase, {
      q: sp.get("q"),
      status: (sp.get("status") as VideoSubmissionStatus) || null,
      source_type: (sp.get("source_type") as VideoSourceType) || null,
      assigned:
        (sp.get("assigned") as "assigned" | "unassigned" | null) ?? null,
      limit: sp.get("limit") ? Number(sp.get("limit")) : undefined,
      offset: sp.get("offset") ? Number(sp.get("offset")) : undefined,
    });
    return jsonOk({ submissions: rows, count });
  } catch (e) {
    return handleApiError(e);
  }
}
