import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { ApiError } from "@/lib/http";

/**
 * Supabase client dùng SERVICE ROLE KEY — BỎ QUA RLS.
 * TUYỆT ĐỐI chỉ dùng phía server (route handler / server action / lib server).
 * KHÔNG bao giờ import vào Client Component.
 */
export function createSupabaseAdminClient() {
  if (typeof window !== "undefined") {
    throw new Error(
      "createSupabaseAdminClient() chỉ được gọi phía server. Không dùng ở client!",
    );
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new ApiError(
      500,
      "Chưa cấu hình SUPABASE_SERVICE_ROLE_KEY trên Vercel. Vào Vercel → Project timvideo → Settings → Environment Variables, thêm biến SUPABASE_SERVICE_ROLE_KEY (lấy tại Supabase → Project Settings → API → service_role secret), rồi Redeploy.",
      "SERVICE_ROLE_MISSING",
    );
  }
  return createClient<Database>(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
