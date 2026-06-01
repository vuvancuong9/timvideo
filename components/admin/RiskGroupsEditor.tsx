"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui";
import type {
  PolicyRiskGroup,
  RiskGroupCategory,
} from "@/lib/video-review/policy-groups-config";

const KEY_RE = /^[a-z][a-z0-9_]*$/;
const RESERVED = new Set<string>([
  "policy_safety_score",
  "copyright_safety_score",
  "risk_reasons",
  "policy_references",
  "suggested_fixes",
  "final_policy_level",
  "confidence",
]);

const blankRow = (): PolicyRiskGroup => ({
  key: "",
  label_vi: "",
  description_vi: "",
  category: "policy",
  critical_blocks: false,
  enabled: true,
});

export function RiskGroupsEditor({ initial }: { initial: PolicyRiskGroup[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<PolicyRiskGroup[]>(() =>
    initial.map((g) => ({ ...g })),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  function update(i: number, patch: Partial<PolicyRiskGroup>) {
    setOk(false);
    setRows((p) => p.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function addRow() {
    setOk(false);
    setRows((p) => [...p, blankRow()]);
  }
  function removeRow(i: number) {
    setOk(false);
    setRows((p) => p.filter((_, idx) => idx !== i));
  }

  function validate(): string | null {
    if (rows.length === 0) return "Cần ít nhất 1 nhóm rủi ro.";
    const seen = new Set<string>();
    for (const r of rows) {
      const key = r.key.trim().toLowerCase();
      if (!key) return "Mỗi nhóm cần có 'key' (mã định danh, vd: misleading_claim_risk).";
      if (!KEY_RE.test(key))
        return `Key "${r.key}" không hợp lệ — chỉ chữ thường a–z, số, gạch dưới; bắt đầu bằng chữ.`;
      if (RESERVED.has(key))
        return `Key "${key}" trùng từ khóa hệ thống — hãy đổi tên khác.`;
      if (seen.has(key)) return `Key "${key}" bị trùng.`;
      seen.add(key);
      if (!r.label_vi.trim()) return `Nhóm "${key}" cần có Tên hiển thị.`;
    }
    return null;
  }

  const hasCopyrightBlocker = rows.some(
    (r) => r.enabled && r.category === "copyright" && r.critical_blocks,
  );

  async function save() {
    const v = validate();
    if (v) {
      setError(v);
      setOk(false);
      return;
    }
    setBusy(true);
    setError(null);
    setOk(false);
    try {
      const res = await fetch("/api/admin/policy-rules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ riskGroups: rows }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          [j.error, j.detail].filter(Boolean).join(" — ") || "Lưu thất bại",
        );
      }
      setRows((j.riskGroups as PolicyRiskGroup[]).map((g) => ({ ...g })));
      setOk(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Có lỗi xảy ra");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <h2 className="mb-1 font-semibold text-gray-900">
        Nhóm rủi ro chính sách được AI chấm
      </h2>
      <p className="mb-3 text-xs text-gray-500">
        AI chấm mỗi nhóm ở mức low/medium/high/critical. <b>Mô tả</b> được đưa vào
        prompt để AI chấm đúng — viết rõ ràng. <b>Nhóm</b> = chính sách (policy)
        hay bản quyền (copyright). Bật <b>“critical ⇒ chặn”</b> để khi nhóm này bị
        chấm “critical” thì tự động Từ chối theo loại tương ứng.
      </p>

      {error && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {ok && (
        <p className="mb-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
          ✅ Đã lưu nhóm rủi ro. Áp dụng cho các lần chấm tiếp theo.
        </p>
      )}
      {!hasCopyrightBlocker && (
        <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
          ⚠️ Không còn nhóm <b>bản quyền</b> nào bật “critical ⇒ chặn”. Việc Từ
          chối bản quyền vẫn hoạt động theo ngưỡng điểm, nhưng sẽ không tự chặn khi
          một nhóm bản quyền bị chấm “critical”.
        </p>
      )}

      <div className="space-y-3">
        {rows.map((r, i) => (
          <div
            key={i}
            className="rounded-lg border border-gray-200 p-3 sm:p-4"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Labeled label="Tên hiển thị (tiếng Việt)">
                <input
                  type="text"
                  value={r.label_vi}
                  onChange={(e) => update(i, { label_vi: e.target.value })}
                  placeholder="VD: Nói quá / gây hiểu lầm"
                  className={inputClass}
                />
              </Labeled>
              <Labeled label="Key (mã định danh — ổn định)">
                <input
                  type="text"
                  value={r.key}
                  onChange={(e) => update(i, { key: e.target.value })}
                  placeholder="vd: misleading_claim_risk"
                  className={`${inputClass} font-mono`}
                />
              </Labeled>
            </div>

            <div className="mt-3">
              <Labeled label="Mô tả cho AI (đưa vào prompt)">
                <textarea
                  value={r.description_vi}
                  onChange={(e) =>
                    update(i, { description_vi: e.target.value })
                  }
                  rows={2}
                  placeholder="VD: tuyên bố sai/gây hiểu lầm, hứa hẹn quá đà"
                  className={inputClass}
                />
              </Labeled>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-4">
              <Labeled label="Nhóm">
                <select
                  value={r.category}
                  onChange={(e) =>
                    update(i, {
                      category: e.target.value as RiskGroupCategory,
                    })
                  }
                  className={inputClass}
                >
                  <option value="policy">Chính sách (policy)</option>
                  <option value="copyright">Bản quyền (copyright)</option>
                </select>
              </Labeled>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={r.critical_blocks}
                  onChange={(e) =>
                    update(i, { critical_blocks: e.target.checked })
                  }
                />
                critical ⇒ chặn (tự Từ chối)
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={r.enabled}
                  onChange={(e) => update(i, { enabled: e.target.checked })}
                />
                Bật
              </label>
              <button
                type="button"
                onClick={() => removeRow(i)}
                className="ml-auto rounded-lg px-2 py-1 text-sm font-medium text-red-600 hover:bg-red-50"
              >
                Xóa
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={addRow}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          + Thêm nhóm
        </button>
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
        >
          {busy ? "Đang lưu…" : "Lưu nhóm rủi ro"}
        </button>
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
      <label className="mb-1 block text-xs font-medium text-gray-600">
        {label}
      </label>
      {children}
    </div>
  );
}
