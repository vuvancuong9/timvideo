import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

type VideoBase = Database["public"]["Tables"]["video_submissions"]["Row"];

export type VideoRow = VideoBase & {
  creator: { id: string; full_name: string | null; email: string } | null
  category: { id: string; name: string } | null
  affiliate: { id: string; code: string; name: string } | null
};

const VIDEO_SELECT = `
  *,
  creator:profiles!video_submissions_created_by_fkey(id,full_name,email),
  category:product_categories(id,name),
  affiliate:affiliate_accounts(id,code,name)
`;

export type VideoFilters = {
  status?: string | null;
  source?: string | null;
  categoryId?: string | null;
  employeeId?: string | null;
  assigned?: "assigned" | "unassigned" | null;
  q?: string | null;
  limit?: number;
  offset?: number;
};

/**
 * Truy vấn danh sách video. RLS tự giới hạn: staff chỉ thấy của mình,
 * accountant/aggregator/admin thấy tất cả.
 */
export async function fetchVideos(
  supabase: SupabaseClient<Database>,
  f: VideoFilters = {},
): Promise<{ rows: VideoRow[]; count: number }> {
  let query = supabase
    .from("video_submissions")
    .select(VIDEO_SELECT, { count: "exact" })
    .order("created_at", { ascending: false });

  if (f.status) {
    query = query.eq(
      "status",
      f.status as Database["public"]["Enums"]["video_status"],
    );
  }
  if (f.source) {
    query = query.eq(
      "video_source",
      f.source as Database["public"]["Enums"]["video_source"],
    );
  }
  if (f.categoryId) query = query.eq("category_id", f.categoryId);
  if (f.employeeId) query = query.eq("created_by", f.employeeId);
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
        `shopee_product_url.ilike.%${safe}%,video_url.ilike.%${safe}%,short_link.ilike.%${safe}%`,
      );
    }
  }

  const limit = Math.min(Math.max(f.limit ?? 100, 1), 1000);
  const offset = Math.max(f.offset ?? 0, 0);
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) throw error;
  return { rows: (data ?? []) as unknown as VideoRow[], count: count ?? 0 };
}
