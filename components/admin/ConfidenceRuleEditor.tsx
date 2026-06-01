"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui";
import type { ConfidenceRule } from "@/lib/video-review/confidence-config";

export function ConfidenceRuleEditor({ initial }: { initial: ConfidenceRule }) {
  const router = useRouter();
  const [noFileMax, setNoFileMax] = useState<"low" | "medium">(
    initial.no_file_max,
  );
  const [allowHigh, setAllowHigh] = useState(initial.allow_high_with_file);
  const [notes, setNotes] = useState<string[]>(() => [...initial.notes_vi]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  function touched() {
    setOk(false);
  }
  function setNote(i: number, v: string) {
    touched();
    setNotes((p) => p.map((n, idx) => (idx === i ? v : n)));
  }
  function addNote() {
    touched();
    setNotes((p) => [...p, ""]);
  }
  function removeNote(i: number) {
    touched();
    setNotes((p) => p.filter((_, idx) => idx !== i));
  }

  async function save() {
    setBusy(true);
    setError(null);
    setOk(false);
    try {
      const res = await fetch("/api/admin/policy-rules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confidenceRule: {
            no_file_max: noFileMax,
            allow_high_with_file: allowHigh,
            notes_vi: notes,
          },
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          [j.error, j.detail].filter(Boolean).join(" — ") || "Lưu thất bại",
        );
      }
      const saved = j.confidenceRule as ConfidenceRule;
      setNoFileMax(saved.no_file_max);
      setAllowHigh(saved.allow_high_with_file);
      setNotes([...saved.notes_vi]);
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
      <h2 className="mb-1 font-semibold text-gray-900">Độ tin cậy (confidence)</h2>
      <p className="mb-3 text-xs text-gray-500">
        Quy định mức độ tin cậy tối đa khi dữ liệu đầu vào hạn chế (chỉ có link, chưa
        có file video để phân tích).
      </p>

      {error && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {ok && (
        <p className="mb-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
          ✅ Đã lưu luật độ tin cậy.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">
            Khi KHÔNG có file video → tối đa
          </label>
          <select
            value={noFileMax}
            onChange={(e) => {
              touched();
              setNoFileMax(e.target.value as "low" | "medium");
            }}
            className={inputClass}
          >
            <option value="low">Thấp (low)</option>
            <option value="medium">Trung bình (medium)</option>
          </select>
        </div>
        <label className="flex items-end gap-2 pb-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={allowHigh}
            onChange={(e) => {
              touched();
              setAllowHigh(e.target.checked);
            }}
          />
          Có file video → cho phép độ tin cậy “high”
        </label>
      </div>

      <div className="mt-4">
        <p className="mb-1 text-xs font-medium text-gray-600">
          Ghi chú hiển thị (mỗi dòng 1 ý)
        </p>
        <div className="space-y-2">
          {notes.map((n, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="text"
                value={n}
                onChange={(e) => setNote(i, e.target.value)}
                className={inputClass}
              />
              <button
                type="button"
                onClick={() => removeNote(i)}
                className="rounded-lg px-2 py-1 text-sm font-medium text-red-600 hover:bg-red-50"
              >
                Xóa
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addNote}
          className="mt-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          + Thêm dòng
        </button>
      </div>

      <div className="mt-4">
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
        >
          {busy ? "Đang lưu…" : "Lưu độ tin cậy"}
        </button>
      </div>
    </Card>
  );
}

const inputClass =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand";
