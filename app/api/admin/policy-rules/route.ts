import { NextResponse } from "next/server";
import { requireApi } from "@/lib/auth/session";
import { handleApiError, jsonOk } from "@/lib/http";
import {
  FINAL_ACTION_RULES,
  FINAL_DECISION_WEIGHTS,
} from "@/lib/video-review/policy-rules";

export const dynamic = "force-dynamic";

// GET /api/admin/policy-rules — trả về rule deterministic đang dùng (read-only).
export async function GET() {
  try {
    const guard = await requireApi(["admin"]);
    if (guard instanceof NextResponse) return guard;
    return jsonOk({
      weights: FINAL_DECISION_WEIGHTS,
      groups: FINAL_ACTION_RULES,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
