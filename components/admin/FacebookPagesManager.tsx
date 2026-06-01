"use client";

import { useState } from "react";

export type FacebookPage = {
  id: string;
  affiliate_account_id: string;
  name: string;
  url: string | null;
  note: string | null;
  is_active: boolean;
};

/**
 * Quản lý Facebook Page của 1 tài khoản affiliate. Dùng chung cho admin và
 * aggregator (cả 2 đều có quyền sửa — API tự guard role). Hiển thị danh sách
 * page + form thêm + sửa/xóa từng page.
 */
export function FacebookPagesManager({
  accountId,
  initialPages,
}: {
  accountId: string;
  initialPages: FacebookPage[];
}) {
  const [pages, setPages] = useState<FacebookPage[]>(initialPages);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/facebook-pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          affiliate_account_id: accountId,
          name,
          url,
          note,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Thêm Page thất bại");
      setPages((p) => [...p, j.page as FacebookPage]);
      setName("");
      setUrl("");
      setNote("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra");
    } finally {
      setBusy(false);
    }
  }

  async function savePage(p: FacebookPage) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/facebook-pages/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: p.name,
          url: p.url,
          note: p.note,
          is_active: p.is_active,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Cập nhật thất bại");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra");
    } finally {
      setBusy(false);
    }
  }

  async function removePage(id: string) {
    if (!confirm("Xóa Facebook Page này?")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/facebook-pages/${id}`, {
        method: "DELETE",
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Xóa thất bại");
      setPages((list) => list.filter((p) => p.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra");
    } finally {
      setBusy(false);
    }
  }

  function patchLocal(id: string, patch: Partial<FacebookPage>) {
    setPages((list) =>
      list.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    );
  }

  return (
    <div className="space-y-3 rounded-lg bg-gray-50 p-3">
      {error && (
        <p className="rounded bg-red-50 px-2 py-1 text-xs text-red-700">
          {error}
        </p>
      )}

      {pages.length === 0 ? (
        <p className="text-xs text-gray-400">Chưa có Facebook Page nào.</p>
      ) : (
        <ul className="space-y-2">
          {pages.map((p) => (
            <li
              key={p.id}
              className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white p-2"
            >
              <input
                value={p.name}
                onChange={(e) => patchLocal(p.id, { name: e.target.value })}
                placeholder="Tên Page"
                className={pageInput + " w-40"}
              />
              <input
                value={p.url ?? ""}
                onChange={(e) => patchLocal(p.id, { url: e.target.value })}
                placeholder="Link Page"
                className={pageInput + " w-56"}
              />
              <input
                value={p.note ?? ""}
                onChange={(e) => patchLocal(p.id, { note: e.target.value })}
                placeholder="Ghi chú"
                className={pageInput + " w-40"}
              />
              <label className="flex items-center gap-1 text-xs text-gray-500">
                <input
                  type="checkbox"
                  checked={p.is_active}
                  onChange={(e) =>
                    patchLocal(p.id, { is_active: e.target.checked })
                  }
                />
                Hoạt động
              </label>
              {p.url && (
                <a
                  href={p.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-brand hover:underline"
                >
                  Mở
                </a>
              )}
              <button
                onClick={() => savePage(p)}
                disabled={busy}
                className="rounded bg-brand px-2 py-1 text-xs font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
              >
                Lưu
              </button>
              <button
                onClick={() => removePage(p.id)}
                disabled={busy}
                className="rounded border border-red-300 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                Xóa
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={add} className="flex flex-wrap items-center gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Tên Page *"
          className={pageInput + " w-40"}
        />
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Link Page (facebook.com/...)"
          className={pageInput + " w-56"}
        />
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Ghi chú"
          className={pageInput + " w-40"}
        />
        <button
          type="submit"
          disabled={busy || !name.trim()}
          className="rounded bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
        >
          + Thêm Page
        </button>
      </form>
    </div>
  );
}

const pageInput =
  "rounded border border-gray-300 px-2 py-1 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand";
