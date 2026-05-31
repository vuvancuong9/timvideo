import { NextResponse } from "next/server";
import { requireApi } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  accountSlug,
  vnDateDDMM,
  nextSubId,
} from "@/lib/video-intake/sub-id";
import { handleApiError, jsonOk } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/video-intake/next-sub-id — Sub ID dự kiến cho nhân viên hiện tại.
export async function GET() {
  try {
    const guard = await requireApi(["staff", "aggregator", "admin"]);
    if (guard instanceof NextResponse) return guard;
    const session = guard;

    const admin = createSupabaseAdminClient();
    const account = accountSlug(session.email, session.profile.full_name);
    const date = vnDateDDMM();
    const subId = await nextSubId(admin, session.userId, account, date);

    return jsonOk({ subId, account, date });
  } catch (e) {
    return handleApiError(e);
  }
}
