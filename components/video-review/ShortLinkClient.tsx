"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui";
import {
  SUBMISSION_STATUS_LABELS,
  STATUS_COLORS,
} from "@/lib/video-intake/labels";
import type { SubmissionWithRelations } from "@/lib/video-intake/queries";

export function ShortLinkClient({
  rows,
}: {
  rows: SubmissionWithRelations[];
}) {
  const router = useRouter();
  const [links, setLinks] = useState<Record<string, string>>(() =>
    Object.fromEntries(rows.map((v) => [v.id, v.short_link ?? ""])),
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save(id: string) {
    setBusy(id);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/video-submissions/${id}/short-link`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ short_link: links[id] || null }),
        },
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Lưu link rút gọn thất bại");
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
              <th className="px-3 py-2">Tên sản phẩm</th>
              <th className="px-3 py-2">Affiliate</th>
              <th className="px-3 py-2">Trạng thái</th>
              <th className="px-3 py-2">Link rút gọn</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((v) => (
              <tr key={v.id} className="hover:bg-gray-50">
                <td className="px-3 py-2">
                  <a
                    href={v.shopee_product_url}
                    target="_blank"
                    rel="noreferrer"
                    className="block max-w-[220px] truncate font-medium text-brand hover:underline"
                    title={v.product_name ?? v.shopee_product_url}
                  >
                    {v.product_name || v.shopee_product_url}
                  </a>
                </td>
                <td className="px-3 py-2 text-gray-600">
                  {v.affiliate?.code ?? "—"}
                </td>
                <td className="px-3 py-2">
                  <Badge color={STATUS_COLORS[v.status]}>
                    {SUBMISSION_STATUS_LABELS[v.status]}
                  </Badge>
                </td>
                <td className="px-3 py-2">
                  <input
                    value={links[v.id] ?? ""}
                    onChange={(e) =>
                      setLinks((p) => ({ ...p, [v.id]: e.target.value }))
                    }
                    placeholder="https://…"
                    className="w-64 rounded border border-gray-300 px-2 py-1 text-sm"
                  />
                </td>
                <td className="px-3 py-2">
                  <button
                    onClick={() => save(v.id)}
                    disabled={busy === v.id}
                    className="rounded-lg bg-brand px-3 py-1 text-xs font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
                  >
                    {busy === v.id ? "…" : "Lưu"}
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
