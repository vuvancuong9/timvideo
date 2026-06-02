"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui";
import type { DecisionThresholds } from "@/lib/video-review/final-decision";

type FieldDef = { key: keyof DecisionThresholds; label: string };

// Trọng số content_score (review/lan tỏa) — nên cộng = 1.
const WEIGHT_FIELDS: FieldDef[] = [
  { key: "w_review_depth", label: "Trọng số độ sâu review" },
  { key: "w_viral_hook", label: "Trọng số hook lan tỏa" },
  { key: "w_retention", label: "Trọng số giữ chân người xem" },
  { key: "w_authenticity", label: "Trọng số độ chân thật" },
  { key: "w_product_demo", label: "Trọng số demo sản phẩm" },
  { key: "w_sales_conversion", label: "Trọng số khả năng chuyển đổi" },
];

// Cổng chặn policy/bản quyền (hard gate).
const POLICY_GATE_FIELDS: FieldDef[] = [
  { key: "reject_policy_below", label: "Từ chối khi điểm policy <" },
  { key: "reject_copyright_below", label: "Từ chối khi điểm bản quyền <" },
  { key: "need_edit_policy_below", label: "Cần sửa khi điểm policy <" },
  { key: "approve_policy_min", label: "Duyệt khi điểm policy ≥" },
  { key: "approve_copyright_min", label: "Duyệt khi điểm bản quyền ≥" },
];

// Cổng review/nội dung.
const REVIEW_GATE_FIELDS: FieldDef[] = [
  { key: "review_depth_reject_below", label: "Làm lại review khi review depth <" },
  { key: "review_depth_need_edit_below", label: "Cần sửa khi review depth <" },
  { key: "approve_content_min", label: "Duyệt khi content score ≥" },
  { key: "approve_review_depth_min", label: "Duyệt khi review depth ≥" },
  { key: "low_quality_below", label: "Review/viral kém khi content <" },
  { key: "need_edit_content_below", label: "Cần sửa khi content <" },
];

export function PolicyRulesClient({ initial }: { initial: DecisionThresholds }) {
  const router = useRouter();
  const [t, setT] = useState<DecisionThresholds>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const weightSum =
    Number(t.w_review_depth) +
    Number(t.w_viral_hook) +
    Number(t.w_retention) +
    Number(t.w_authenticity) +
    Number(t.w_product_demo) +
    Number(t.w_sales_conversion);
  const weightWarn = Math.abs(weightSum - 1) > 0.001;

  function set(key: keyof DecisionThresholds, value: string) {
    setOk(false);
    setT((p) => ({ ...p, [key]: value === "" ? 0 : Number(value) }));
  }

  async function save() {
    setBusy(true);
    setError(null);
    setOk(false);
    try {
      const res = await fetch("/api/admin/policy-rules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(t),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          [j.error, j.detail].filter(Boolean).join(" — ") || "Lưu thất bại",
        );
      }
      setT(j.thresholds as DecisionThresholds);
      setOk(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Có lỗi xảy ra");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {ok && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
          ✅ Đã lưu. Áp dụng cho các lần chấm điểm tiếp theo.
        </p>
      )}

      <p className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-800">
        Policy & bản quyền là <b>CỔNG CHẶN</b> — KHÔNG cộng trung bình để cứu
        điểm. <b>content_score</b> chỉ đo chất lượng review/lan tỏa và{" "}
        <b>final_score = content_score</b>. Video chưa phải review thật (sales_deal)
        hoặc chưa có video thật sẽ không được tự duyệt chạy ads.
      </p>

      <Card>
        <h2 className="mb-1 font-semibold text-gray-900">
          Trọng số nội dung review/lan tỏa (content_score)
        </h2>
        <p className="mb-3 text-xs text-gray-500">
          content_score = tổng có trọng số 6 tiêu chí. Tổng 6 trọng số nên bằng 1.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          {WEIGHT_FIELDS.map((f) => (
            <NumField
              key={f.key}
              label={f.label}
              value={t[f.key]}
              step="0.05"
              onChange={(v) => set(f.key, v)}
            />
          ))}
        </div>
        <p
          className={`mt-2 text-xs ${weightWarn ? "text-amber-600" : "text-gray-400"}`}
        >
          Tổng trọng số hiện tại: {weightSum.toFixed(2)}
          {weightWarn ? " ⚠️ nên bằng 1.00" : " ✓"}
        </p>
      </Card>

      <Card>
        <h2 className="mb-1 font-semibold text-gray-900">
          Cổng chặn Policy / Bản quyền
        </h2>
        <p className="mb-3 text-xs text-gray-500">
          Điểm theo thang 0–100. Dưới ngưỡng từ chối → REJECT bất kể nội dung tốt
          tới đâu.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {POLICY_GATE_FIELDS.map((f) => (
            <NumField
              key={f.key}
              label={f.label}
              value={t[f.key]}
              step="1"
              onChange={(v) => set(f.key, v)}
            />
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="mb-1 font-semibold text-gray-900">
          Cổng review / nội dung
        </h2>
        <p className="mb-3 text-xs text-gray-500">
          review_depth thấp → REMAKE_AS_REVIEW. content_score thấp →
          LOW_REVIEW_QUALITY. Đạt đủ ngưỡng + an toàn → APPROVE.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {REVIEW_GATE_FIELDS.map((f) => (
            <NumField
              key={f.key}
              label={f.label}
              value={t[f.key]}
              step="1"
              onChange={(v) => set(f.key, v)}
            />
          ))}
        </div>
      </Card>

      <button
        onClick={save}
        disabled={busy}
        className="rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
      >
        {busy ? "Đang lưu…" : "Lưu cấu hình"}
      </button>
    </div>
  );
}

function NumField({
  label,
  value,
  step,
  onChange,
}: {
  label: string;
  value: number;
  step: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-600">
        {label}
      </label>
      <input
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand"
      />
    </div>
  );
}
