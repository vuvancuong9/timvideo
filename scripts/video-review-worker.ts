/**
 * Local worker loop. Chạy: npx tsx scripts/video-review-worker.ts
 * Cần env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *          OPENAI_API_KEY, GEMINI_API_KEY (và Drive nếu có file).
 *
 * Đọc .env.local nếu có (qua --env-file của node 20+ hoặc tsx).
 */
import { runVideoReviewWorkerOnce } from "@/lib/video-review/worker-core";

const INTERVAL_MS = Number(process.env.WORKER_INTERVAL_MS ?? 5000);

async function loop() {
  // eslint-disable-next-line no-console
  console.log("[worker] start, interval =", INTERVAL_MS, "ms");
  for (;;) {
    try {
      const res = await runVideoReviewWorkerOnce({
        workerName: `local-${process.pid}`,
        deadlineMs: 60_000,
      });
      if (res.processed > 0) {
        // eslint-disable-next-line no-console
        console.log("[worker] processed", res.processed, res.results);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[worker] error:", err);
    }
    await new Promise((r) => setTimeout(r, INTERVAL_MS));
  }
}

loop().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("[worker] fatal:", err);
  process.exit(1);
});
