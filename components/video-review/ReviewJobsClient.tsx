"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, type BadgeColor } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import type { Database } from "@/lib/database.types";

type JobRow = Database["public"]["Tables"]["video_review_jobs"]["Row"];

const STATUS_COLORS: Record<string, BadgeColor> = {
  queued: "gray",
  running: "yellow",
  done: "green",
  failed: "red",
  cancelled: "gray",
};

export function ReviewJobsClient({ jobs }: { jobs: JobRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function retry(id: string) {
    setBusy(id);
    setError(null);
    try {
      const res = await fetch(`/api/video-review/jobs/${id}/retry`, {
        method: "POST",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Retry thất bại");
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Có lỗi xảy ra");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-3 py-2">Tạo lúc</th>
              <th className="px-3 py-2">Submission</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Stage</th>
              <th className="px-3 py-2">Attempt</th>
              <th className="px-3 py-2">Lỗi</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {jobs.map((j) => (
              <tr key={j.id} className="align-top hover:bg-gray-50">
                <td className="whitespace-nowrap px-3 py-2 text-gray-500">
                  {formatDateTime(j.created_at)}
                </td>
                <td className="px-3 py-2 font-mono text-xs text-gray-500">
                  {j.video_submission_id.slice(0, 8)}…
                </td>
                <td className="px-3 py-2">
                  <Badge color={STATUS_COLORS[j.status] ?? "gray"}>
                    {j.status}
                  </Badge>
                </td>
                <td className="px-3 py-2 text-gray-600">{j.stage}</td>
                <td className="px-3 py-2">{j.attempt_count}</td>
                <td className="px-3 py-2">
                  {j.error ? (
                    <code className="block max-w-[280px] truncate text-xs text-red-600">
                      {j.error}
                    </code>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-3 py-2">
                  <button
                    onClick={() => retry(j.id)}
                    disabled={busy === j.id}
                    className="rounded-lg border border-gray-300 px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                  >
                    {busy === j.id ? "…" : "Retry"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
