"use client";

import { useState } from "react";

/** Nút admin gọi 1 endpoint đồng bộ Sheet (POST) và hiển thị kết quả. */
export function SheetSyncButton({
  endpoint,
  label,
}: {
  endpoint: string;
  label: string;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      const res = await fetch(endpoint, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Đồng bộ thất bại");
      setMsg(json.message || "Hoàn tất.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Có lỗi xảy ra");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={run}
        disabled={busy}
        className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? "Đang chạy…" : label}
      </button>
      {msg && <span className="text-sm text-green-700">{msg}</span>}
      {err && <span className="text-sm text-red-600">{err}</span>}
    </div>
  );
}
