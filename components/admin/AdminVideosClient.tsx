"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Constants } from "@/lib/database.types";
import { VIDEO_STATUS_LABELS } from "@/lib/constants";
import { SourceBadge } from "@/components/ui";
import { formatCurrency } from "@/lib/format";
import type { VideoRow } from "@/lib/videos";

type Affiliate = { id: string; code: string; name: string };

type EditState = {
  status: string;
  affiliateId: string;
  shortLink: string;
  adminNote: string;
};

export function AdminVideosClient({
  videos,
  affiliateAccounts,
}: {
  videos: VideoRow[];
  affiliateAccounts: Affiliate[];
}) {
  const router = useRouter();
  const [edits, setEdits] = useState<Record<string, EditState>>(() =>
    Object.fromEntries(
      videos.map((v) => [
        v.id,
        {
          status: v.status,
          affiliateId: v.assigned_affiliate_account_id ?? "",
          shortLink: v.short_link ?? "",
          adminNote: v.admin_note ?? "",
        },
      ]),
    ),
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function set(id: string, value: Partial<EditState>) {
    setEdits((p) => ({ ...p, [id]: { ...p[id], ...value } }));
  }

  async function save(id: string) {
    setBusy(id);
    setError(null);
    try {
      const e = edits[id];
      const res = await fetch(`/api/videos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: e.status,
          assigned_affiliate_account_id: e.affiliateId || null,
          short_link: e.shortLink || null,
          admin_note: e.adminNote || null,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Cập nhật thất bại");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra");
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
              <th className="px-3 py-2">Sản phẩm</th>
              <th className="px-3 py-2">Nhân viên</th>
              <th className="px-3 py-2">Nguồn</th>
              <th className="px-3 py-2">HH dự kiến</th>
              <th className="px-3 py-2">Trạng thái</th>
              <th className="px-3 py-2">Affiliate</th>
              <th className="px-3 py-2">Link rút gọn</th>
              <th className="px-3 py-2">Ghi chú admin</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {videos.map((v) => (
              <tr key={v.id} className="hover:bg-gray-50">
                <td className="px-3 py-2">
                  <a
                    href={v.shopee_product_url}
                    target="_blank"
                    rel="noreferrer"
                    className="block max-w-[180px] truncate text-brand hover:underline"
                    title={v.shopee_product_url}
                  >
                    {v.shopee_product_url}
                  </a>
                </td>
                <td className="px-3 py-2 text-gray-600">
                  {v.creator?.full_name || v.creator?.email || "—"}
                </td>
                <td className="px-3 py-2">
                  <SourceBadge source={v.video_source} />
                </td>
                <td className="whitespace-nowrap px-3 py-2">
                  {formatCurrency(v.estimated_commission)}
                </td>
                <td className="px-3 py-2">
                  <select
                    value={edits[v.id]?.status}
                    onChange={(e) => set(v.id, { status: e.target.value })}
                    className="rounded border border-gray-300 px-1 py-1 text-xs"
                  >
                    {Constants.public.Enums.video_status.map((s) => (
                      <option key={s} value={s}>
                        {VIDEO_STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <select
                    value={edits[v.id]?.affiliateId}
                    onChange={(e) => set(v.id, { affiliateId: e.target.value })}
                    className="rounded border border-gray-300 px-2 py-1 text-sm"
                  >
                    <option value="">—</option>
                    {affiliateAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <input
                    value={edits[v.id]?.shortLink}
                    onChange={(e) => set(v.id, { shortLink: e.target.value })}
                    placeholder="https://…"
                    className="w-40 rounded border border-gray-300 px-2 py-1 text-sm"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    value={edits[v.id]?.adminNote}
                    onChange={(e) => set(v.id, { adminNote: e.target.value })}
                    className="w-32 rounded border border-gray-300 px-2 py-1 text-sm"
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
