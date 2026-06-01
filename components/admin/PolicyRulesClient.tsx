"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui";

export type Thresholds = {
  w_creative: number;
  w_policy: number;
  w_copyright: number;
  reject_policy_below: number;
  reject_copyright_below: number;
  need_edit_policy_below: number;
  approve_creative_min: number;
  approve_policy_min: number;
  approve_copyright_min: number;
  remake_creative_min: number;
};

type FieldDef = { key: keyof Thresholds; label: string; hint?: string };

const WEIGHT_FIELDS: FieldDef[] = [
  { key: "w_creative", label: "Trọng số điểm bán hàng (creative)" },
  { key: "w_policy", label: "Trọng số an toàn chính sách" },
  { key: "w_copyright", label: "Trọng số an toàn bản quyền" },
];

const THRESHOLD_FIELDS: FieldDef[] = [
  {
    key: "reject_policy_below",
    label: "Từ chối (chính sách) khi điểm chính sách <",
  },
  {
    key: "reject_copyright_below",
    label: "Từ chối (bản quyền) khi điểm bản quyền <",
  },
  {
    key: "need_edit_policy_below",
    label: "Cần sửa khi điểm chính sách <",
  },
  { key: "approve_creative_min", label: "Duyệt khi điểm bán hàng ≥" },
  { key: "approve_policy_min", label: "Duyệt khi điểm chính sách ≥" },
  { key: "approve_copyright_min", label: "Duyệt khi điểm bản quyền ≥" },
  { key: "remake_creative_min", label: "Remake an toàn khi điểm bán hàng ≥" },
];

export function PolicyRulesClient({ initial }: { initial: Thresholds }) {
  const router = useRouter();
  const [t, setT] = useState<Thresholds>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const weightSum =
    Number(t.w_creative) + Number(t.w_policy) + Number(t.w_copyright);
  const weightWarn = Math.abs(weightSum - 1) > 0.001;

  function set(key: keyof Thresholds, value: string) {
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
      setT(j.thresholds as Thresholds);
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

      <Card>
        <h2 className="mb-1 font-semibold text-gray-900">
          Trọng số điểm tổng (final_score)
        </h2>
        <p className="mb-3 text-xs text-gray-500">
          final_score = creative×w_creative + policy×w_policy +
          copyright×w_copyright. Tổng 3 trọng số nên bằng 1.
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
        <h2 className="mb-1 font-semibold text-gray-900">Ngưỡng quyết định</h2>
        <p className="mb-3 text-xs text-gray-500">
          Thứ tự xét: Từ chối chính sách → Từ chối bản quyền → Cần sửa → Duyệt
          chạy ads → Remake an toàn → Bán hàng kém. Điểm theo thang 0–100.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {THRESHOLD_FIELDS.map((f) => (
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
