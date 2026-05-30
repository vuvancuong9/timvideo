/** Helper dùng chung cho aggregator + admin review dashboard pages. */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  fetchSubmissions,
  fetchLatestDecisionsMap,
  fetchLatestPolicyLevelMap,
} from "@/lib/video-intake/queries";
import type { Database } from "@/lib/database.types";
import type { DashboardRow } from "@/components/video-review/ReviewDashboardTable";
import type {
  VideoSourceType,
  VideoSubmissionStatus,
} from "@/types/videoIntake";
import type { VideoFinalAction, RiskLevel } from "@/types/videoReview";

export type DashboardParams = {
  q?: string;
  status?: string;
  source_type?: string;
  final_action?: string;
  policy_risk?: string;
  assigned?: string;
};

export async function loadReviewDashboard(
  supabase: SupabaseClient<Database>,
  params: DashboardParams,
): Promise<DashboardRow[]> {
  const { rows } = await fetchSubmissions(supabase, {
    q: params.q,
    status: (params.status as VideoSubmissionStatus) || null,
    source_type: (params.source_type as VideoSourceType) || null,
    assigned: (params.assigned as "assigned" | "unassigned") || null,
    limit: 1000,
  });
  const ids = rows.map((r) => r.id);
  const [decisions, policyLevels] = await Promise.all([
    fetchLatestDecisionsMap(supabase, ids),
    fetchLatestPolicyLevelMap(supabase, ids),
  ]);

  let items: DashboardRow[] = rows.map((r) => ({
    submission: r,
    decision: decisions.get(r.id) ?? null,
    policy_level: policyLevels.get(r.id) ?? null,
  }));

  const fa = params.final_action as VideoFinalAction | undefined;
  const pr = params.policy_risk as RiskLevel | undefined;
  if (fa) items = items.filter((it) => it.decision?.final_action === fa);
  if (pr) items = items.filter((it) => it.policy_level === pr);
  return items;
}
