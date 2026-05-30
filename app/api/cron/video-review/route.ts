import { NextRequest, NextResponse } from "next/server";
import { runVideoReviewWorkerOnce } from "@/lib/video-review/worker-core";
import { getWorkerSecret } from "@/lib/secrets";
import { handleApiError, jsonError, jsonOk } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// GET /api/cron/video-review
// Bảo vệ: header Authorization: Bearer <VIDEO_REVIEW_WORKER_SECRET>
// hoặc Vercel Cron (gửi header x-vercel-cron). Nếu chưa set secret -> chỉ cho Vercel cron.
export async function GET(req: NextRequest) {
  try {
    const secret = getWorkerSecret();
    const auth = req.headers.get("authorization") ?? "";
    const isVercelCron = req.headers.has("x-vercel-cron");
    const bearerOk = secret ? auth === `Bearer ${secret}` : false;

    if (!isVercelCron && !bearerOk) {
      return jsonError(401, "Unauthorized", "UNAUTHENTICATED");
    }

    const result = await runVideoReviewWorkerOnce({
      workerName: "vercel-cron",
      deadlineMs: 55_000, // soft deadline < maxDuration
    });
    return jsonOk(result);
  } catch (e) {
    return handleApiError(e);
  }
}
