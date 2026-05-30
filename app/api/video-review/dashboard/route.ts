import { NextRequest, NextResponse } from "next/server";
import { requireApi } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  fetchSubmissions,
  fetchLatestDecisionsMap,
  fetchLatestPolicyLevelMap,
} from "@/lib/video-intake/queries";
import { handleApiError, jsonOk } from "@/lib/http";
import type {
  VideoSourceType,
  VideoSubmissionStatus,
} from "@/types/videoIntake";
import type { VideoFinalAction, RiskLevel } from "@/types/videoReview";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/video-review/dashboard?final_action=&status=&staff=&policy_risk=&q=
// staff bị RLS giới hạn chỉ thấy của mình; accountant/aggregator/admin thấy tất cả.
export async function GET(req: NextRequest) {
  try {
    const guard = await requireApi();
    if (guard instanceof NextResponse) return guard;

    const sp = req.nextUrl.searchParams;
    const finalAction = sp.get("final_action") as VideoFinalAction | null;
    const policyRisk = sp.get("policy_risk") as RiskLevel | null;

    const supabase = await createSupabaseServerClient();
    const { rows } = await fetchSubmissions(supabase, {
      q: sp.get("q"),
      status: (sp.get("status") as VideoSubmissionStatus) || null,
      source_type: (sp.get("source_type") as VideoSourceType) || null,
      created_by: sp.get("staff"),
      limit: 1000,
    });

    const ids = rows.map((r) => r.id);
    const [decisions, policyLevels] = await Promise.all([
      fetchLatestDecisionsMap(supabase, ids),
      fetchLatestPolicyLevelMap(supabase, ids),
    ]);

    let items = rows.map((r) => ({
      submission: r,
      decision: decisions.get(r.id) ?? null,
      policy_level: policyLevels.get(r.id) ?? null,
    }));

    if (finalAction) {
      items = items.filter((it) => it.decision?.final_action === finalAction);
    }
    if (policyRisk) {
      items = items.filter((it) => it.policy_level === policyRisk);
    }

    return jsonOk({ items, count: items.length });
  } catch (e) {
    return handleApiError(e);
  }
}
