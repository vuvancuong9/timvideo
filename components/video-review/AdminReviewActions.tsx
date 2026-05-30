"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui";
import { Constants } from "@/lib/database.types";
import { SUBMISSION_STATUS_LABELS } from "@/lib/video-intake/labels";
import type { SubmissionWithRelations } from "@/lib/video-intake/queries";

type Affiliate = { id: string; code: string; name: string };

export function AdminReviewActions({
  submission,
  affiliateAccounts,
}: {
  submission: SubmissionWithRelations;
  affiliateAccounts: Affiliate[];
}) {
  const router = useRouter();
  const [status, setStatus] = useState(submission.status);
  const [affiliateId, setAffiliateId] = useState(
    submission.assigned_affiliate_account_id ?? "",
  );
  const [shortLink, setShortLink] = useState(submission.short_link ?? "");
  const [adminNote, setAdminNote] = useState(submission.admin_note ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function call(url: string, body: unknown) {
    const res = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j.error || "Thao tác thất bại");
    }
  }

  async function saveAll() {
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      // status
      if (status !== submission.status) {
        await call(`/api/admin/video-submissions/${submission.id}/status`, {
          status,
        });
      }
      // affiliate
      if (affiliateId !== (submission.assigned_affiliate_account_id ?? "")) {
        await call(
          `/api/aggregate/video-submissions/${submission.id}/assign-affiliate`,
          { affiliate_account_id: affiliateId || null },
        );
      }
      // short link (admin only)
      if (shortLink !== (submission.short_link ?? "")) {
        await call(
          `/api/admin/video-submissions/${submission.id}/short-link`,
          { short_link: shortLink || null },
        );
      }
      // admin note via generic PATCH
      if (adminNote !== (submission.admin_note ?? "")) {
        await call(`/api/video-intake/submissions/${submission.id}`, {
          admin_note: adminNote || null,
        });
      }
      setMsg("Đã lưu thay đổi.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Có lỗi xảy ra");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <h2 className="mb-3 font-semibold text-gray-900">Hành động admin</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <Labeled label="Trạng thái">
          <select
            value={status}
            onChange={(e) =>
              setStatus(
                e.target
                  .value as (typeof Constants.public.Enums.video_submission_status)[number],
              )
            }
            className={inputClass}
          >
            {Constants.public.Enums.video_submission_status.map((s) => (
              <option key={s} value={s}>
                {SUBMISSION_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </Labeled>
        <Labeled label="Affiliate account">
          <select
            value={affiliateId}
            onChange={(e) => setAffiliateId(e.target.value)}
            className={inputClass}
          >
            <option value="">— Chưa phân —</option>
            {affiliateAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} — {a.name}
              </option>
            ))}
          </select>
        </Labeled>
        <Labeled label="Link rút gọn (chỉ admin)">
          <input
            value={shortLink}
            onChange={(e) => setShortLink(e.target.value)}
            placeholder="https://…"
            className={inputClass}
          />
        </Labeled>
        <Labeled label="Ghi chú admin">
          <input
            value={adminNote}
            onChange={(e) => setAdminNote(e.target.value)}
            className={inputClass}
          />
        </Labeled>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button
          onClick={saveAll}
          disabled={busy}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
        >
          {busy ? "Đang lưu…" : "Lưu thay đổi"}
        </button>
        {msg && <span className="text-sm text-green-600">{msg}</span>}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </Card>
  );
}

const inputClass =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand";

function Labeled({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">
        {label}
      </label>
      {children}
    </div>
  );
}
