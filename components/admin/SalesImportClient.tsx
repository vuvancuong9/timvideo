"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const PLACEHOLDER = `employee_id,date,clicks,orders,revenue,commission,source
<uuid nhân viên>,2026-05-01,120,5,1500000,75000,shopee`;

export function SalesImportClient() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function parse() {
    const lines = text
      .trim()
      .split(/\r?\n/)
      .filter((l) => l.trim().length > 0);
    if (lines.length < 2) {
      throw new Error("Cần dòng header và ít nhất 1 dòng dữ liệu.");
    }
    const header = lines[0].split(",").map((h) => h.trim());
    const idx = (name: string) => header.indexOf(name);
    for (const required of ["employee_id", "date"]) {
      if (idx(required) < 0) throw new Error(`Thiếu cột bắt buộc: ${required}`);
    }
    return lines.slice(1).map((line) => {
      const cols = line.split(",");
      const get = (name: string) => {
        const i = idx(name);
        return i >= 0 ? (cols[i] ?? "").trim() : "";
      };
      return {
        employee_id: get("employee_id"),
        date: get("date"),
        clicks: Number(get("clicks") || 0),
        orders: Number(get("orders") || 0),
        revenue: Number(get("revenue") || 0),
        commission: Number(get("commission") || 0),
        source: get("source") || null,
        video_submission_id: get("video_submission_id") || null,
      };
    });
  }

  async function submit() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const records = parse();
      const res = await fetch("/api/admin/sales/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ records }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Import thất bại");
      setResult(`Đã nhập ${j.inserted} dòng doanh số.`);
      setText("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Có lỗi xảy ra");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500">
        Dán dữ liệu CSV (dòng đầu là header). Cột bắt buộc:{" "}
        <code>employee_id</code>, <code>date</code> (YYYY-MM-DD). Cột tùy chọn:
        clicks, orders, revenue, commission, source, video_submission_id.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        placeholder={PLACEHOLDER}
        className="w-full rounded-lg border border-gray-300 p-3 font-mono text-xs"
      />
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {result && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
          {result}
        </p>
      )}
      <button
        onClick={submit}
        disabled={busy || !text.trim()}
        className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
      >
        {busy ? "Đang nhập…" : "Nhập doanh số"}
      </button>
    </div>
  );
}
