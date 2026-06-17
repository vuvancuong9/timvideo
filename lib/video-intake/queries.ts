/**
 * Truy vấn submissions + review bundle. RLS tự giới hạn theo role:
 * staff chỉ thấy của mình; accountant/aggregator/admin thấy tất cả.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type {
  VideoSubmissionStatus,
  VideoSourceType,
} from "@/types/videoIntake";
import type { VideoFinalAction, RiskLevel } from "@/types/videoReview";

type Db = SupabaseClient<Database>;

/**
 * Chia mảng id thành lô nhỏ. PostgREST nhét toàn bộ .in(...) vào URL, nên list
 * vài trăm/nghìn UUID sẽ vượt giới hạn độ dài URL -> 400 Bad Request. Lô ~100
 * id giữ URL an toàn (~4KB).
 */
function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
const IN_BATCH = 100;

export type SubmissionWithRelations =
  Database["public"]["Tables"]["video_submissions"]["Row"] & {
    creator: { id: string; full_name: string | null; email: string } | null;
    category: { id: string; name: string } | null;
    affiliate: { id: string; code: string; name: string } | null;
  };

export type SubmissionFilters = {
  status?: VideoSubmissionStatus | null;
  source_type?: VideoSourceType | null;
  created_by?: string | null;
  assigned?: "assigned" | "unassigned" | null;
  q?: string | null;
  limit?: number;
  offset?: number;
};

const SELECT_WITH_RELATIONS = `
  *,
  creator:profiles!video_submissions_created_by_fkey(id,full_name,email),
  category:product_categories(id,name),
  affiliate:affiliate_accounts(id,code,name)
`;

export async function fetchSubmissions(
  supabase: Db,
  f: SubmissionFilters = {},
): Promise<{ rows: SubmissionWithRelations[]; count: number }> {
  let query = supabase
    .from("video_submissions")
    .select(SELECT_WITH_RELATIONS, { count: "exact" })
    .order("created_at", { ascending: false });

  if (f.status) query = query.eq("status", f.status);
  if (f.source_type) query = query.eq("source_type", f.source_type);
  if (f.created_by) query = query.eq("created_by", f.created_by);
  if (f.assigned === "unassigned") {
    query = query.is("assigned_affiliate_account_id", null);
  }
  if (f.assigned === "assigned") {
    query = query.not("assigned_affiliate_account_id", "is", null);
  }
  if (f.q) {
    const safe = f.q.replace(/[%,()]/g, " ").trim();
    if (safe) {
      query = query.or(
        `product_name.ilike.%${safe}%,shopee_product_url.ilike.%${safe}%,original_video_url.ilike.%${safe}%,short_link.ilike.%${safe}%`,
      );
    }
  }

  const limit = Math.min(Math.max(f.limit ?? 100, 1), 1000);
  const offset = Math.max(f.offset ?? 0, 0);
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) throw error;
  return {
    rows: (data ?? []) as unknown as SubmissionWithRelations[],
    count: count ?? 0,
  };
}

export async function fetchSubmissionById(
  supabase: Db,
  id: string,
): Promise<SubmissionWithRelations | null> {
  const { data, error } = await supabase
    .from("video_submissions")
    .select(SELECT_WITH_RELATIONS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as SubmissionWithRelations) ?? null;
}

export type ReviewBundle = {
  analysis: Database["public"]["Tables"]["video_content_analysis"]["Row"] | null;
  policy: Database["public"]["Tables"]["facebook_policy_checks"]["Row"] | null;
  creative: Database["public"]["Tables"]["video_creative_scores"]["Row"] | null;
  decision:
    | Database["public"]["Tables"]["video_final_decisions"]["Row"]
    | null;
  job: Database["public"]["Tables"]["video_review_jobs"]["Row"] | null;
};

/** Lấy bản LATEST của mỗi loại kết quả review cho 1 submission. */
export async function fetchReviewBundle(
  supabase: Db,
  submissionId: string,
): Promise<ReviewBundle> {
  const latest = <T>(rows: T[] | null): T | null =>
    rows && rows.length ? rows[0] : null;

  const [analysis, policy, creative, decision, job] = await Promise.all([
    supabase
      .from("video_content_analysis")
      .select("*")
      .eq("video_submission_id", submissionId)
      .order("created_at", { ascending: false })
      .limit(1),
    supabase
      .from("facebook_policy_checks")
      .select("*")
      .eq("video_submission_id", submissionId)
      .order("created_at", { ascending: false })
      .limit(1),
    supabase
      .from("video_creative_scores")
      .select("*")
      .eq("video_submission_id", submissionId)
      .order("created_at", { ascending: false })
      .limit(1),
    supabase
      .from("video_final_decisions")
      .select("*")
      .eq("video_submission_id", submissionId)
      .order("created_at", { ascending: false })
      .limit(1),
    supabase
      .from("video_review_jobs")
      .select("*")
      .eq("video_submission_id", submissionId)
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  return {
    analysis: latest(analysis.data),
    policy: latest(policy.data),
    creative: latest(creative.data),
    decision: latest(decision.data),
    job: latest(job.data),
  };
}

export type DecisionLite = {
  video_submission_id: string;
  final_action: VideoFinalAction;
  final_score: number;
  creative_score: number;
  policy_safety_score: number;
  copyright_safety_score: number;
};

/** Map submissionId -> latest decision, cho dashboard/list (gộp ở JS). */
export async function fetchLatestDecisionsMap(
  supabase: Db,
  submissionIds: string[],
): Promise<Map<string, DecisionLite>> {
  const map = new Map<string, DecisionLite>();
  if (submissionIds.length === 0) return map;
  // Lô .in(...) để tránh URL quá dài (400) khi có nhiều submission.
  const results = await Promise.all(
    chunk(submissionIds, IN_BATCH).map((ids) =>
      supabase
        .from("video_final_decisions")
        .select(
          "video_submission_id,final_action,final_score,creative_score,policy_safety_score,copyright_safety_score,created_at",
        )
        .in("video_submission_id", ids)
        .order("created_at", { ascending: false }),
    ),
  );
  for (const { data, error } of results) {
    if (error) throw error;
    for (const row of data ?? []) {
      // vì đã order desc, bản đầu cho mỗi submission là latest
      if (!map.has(row.video_submission_id)) {
        map.set(row.video_submission_id, {
          video_submission_id: row.video_submission_id,
          final_action: row.final_action,
          final_score: Number(row.final_score),
          creative_score: Number(row.creative_score),
          policy_safety_score: Number(row.policy_safety_score),
          copyright_safety_score: Number(row.copyright_safety_score),
        });
      }
    }
  }
  return map;
}

/** Map submissionId -> latest policy final level, cho lọc policy risk. */
export async function fetchLatestPolicyLevelMap(
  supabase: Db,
  submissionIds: string[],
): Promise<Map<string, RiskLevel>> {
  const map = new Map<string, RiskLevel>();
  if (submissionIds.length === 0) return map;
  const results = await Promise.all(
    chunk(submissionIds, IN_BATCH).map((ids) =>
      supabase
        .from("facebook_policy_checks")
        .select("video_submission_id,final_policy_level,created_at")
        .in("video_submission_id", ids)
        .order("created_at", { ascending: false }),
    ),
  );
  for (const { data, error } of results) {
    if (error) throw error;
    for (const row of data ?? []) {
      if (!map.has(row.video_submission_id)) {
        map.set(row.video_submission_id, row.final_policy_level);
      }
    }
  }
  return map;
}
