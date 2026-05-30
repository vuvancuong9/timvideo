"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui";
import {
  SOURCE_TYPE_LABELS,
  SUBMISSION_STATUS_LABELS,
  STATUS_COLORS,
} from "@/lib/video-intake/labels";
import { formatCurrency } from "@/lib/format";
import type { SubmissionWithRelations } from "@/lib/video-intake/queries";

type Affiliate = { id: string; code: string; name: string };

export function AssignClient({
  rows,
  affiliateAccounts,
}: {
  rows: SubmissionWithRelations[];
  affiliateAccounts: Affiliate[];
}) {
  const router = useRouter();
  const [sel, setSel] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      rows.map((v) => [v.id, v.assigned_affiliate_account_id ?? ""]),
    ),
  );
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [bulk, setBulk] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function assign(id: string, affiliateId: string) {
    setBusy(id);
    setError(null);
    try {
      const res = await fetch(
        `/api/aggregate/video-submissions/${id}/assign-affiliate`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ affiliate_account_id: affiliateId || null }),
        },
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Phân affiliate thất bại");
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Có lỗi xảy ra");
    } finally {
      setBusy(null);
    }
  }

  async function bulkAssign() {
    if (!bulk || checked.size === 0) return;
    setBusy("__bulk__");
    setError(null);
    try {
      for (const id of checked) {
        const res = await fetch(
          `/api/aggregate/video-submissions/${id}/assign-affiliate`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ affiliate_account_id: bulk }),
          },
        );
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error || "Phân hàng loạt thất bại");
        }
      }
      setChecked(new Set());
      setBulk("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Có lỗi xảy ra");
    } finally {
      setBusy(null);
    }
  }

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white p-3">
        <span className="text-sm text-gray-600">Đã chọn {checked.size}</span>
        <select
          value={bulk}
          onChange={(e) => setBulk(e.target.value)}
          className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
        >
          <option value="">— Chọn affiliate —</option>
          {affiliateAccounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.code} — {a.name}
            </option>
          ))}
        </select>
        <button
          onClick={bulkAssign}
          disabled={!bulk || checked.size === 0 || busy === "__bulk__"}
          className="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
        >
          {busy === "__bulk__" ? "Đang phân…" : "Phân hàng loạt"}
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-3 py-2"></th>
              <th className="px-3 py-2">Sản phẩm</th>
              <th className="px-3 py-2">Nguồn</th>
              <th className="px-3 py-2">HH dự kiến</th>
              <th className="px-3 py-2">Trạng thái</th>
              <th className="px-3 py-2">Affiliate</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((v) => (
              <tr key={v.id} className="hover:bg-gray-50">
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={checked.has(v.id)}
                    onChange={() => toggle(v.id)}
                  />
                </td>
                <td className="px-3 py-2">
                  <a
                    href={v.original_video_url ?? v.shopee_product_url}
                    target="_blank"
                    rel="noreferrer"
                    className="block max-w-[200px] truncate text-brand hover:underline"
                    title={v.shopee_product_url}
                  >
                    {v.shopee_product_url}
                  </a>
                </td>
                <td className="px-3 py-2">
                  <Badge color="gray">
                    {SOURCE_TYPE_LABELS[v.source_type]}
                  </Badge>
                </td>
                <td className="whitespace-nowrap px-3 py-2">
                  {formatCurrency(v.estimated_commission)}
                </td>
                <td className="px-3 py-2">
                  <Badge color={STATUS_COLORS[v.status]}>
                    {SUBMISSION_STATUS_LABELS[v.status]}
                  </Badge>
                </td>
                <td className="px-3 py-2">
                  <select
                    value={sel[v.id] ?? ""}
                    onChange={(e) =>
                      setSel((p) => ({ ...p, [v.id]: e.target.value }))
                    }
                    className="rounded border border-gray-300 px-2 py-1 text-sm"
                  >
                    <option value="">— Chưa phân —</option>
                    {affiliateAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <button
                    onClick={() => assign(v.id, sel[v.id] ?? "")}
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
