"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Category = {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
};

export function CategoriesClient({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [edits, setEdits] = useState<
    Record<string, { name: string; is_active: boolean }>
  >(() =>
    Object.fromEntries(
      categories.map((c) => [c.id, { name: c.name, is_active: c.is_active }]),
    ),
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy("__add__");
    setError(null);
    try {
      const res = await fetch("/api/admin/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Thêm danh mục thất bại");
      }
      setName("");
      setDescription("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra");
    } finally {
      setBusy(null);
    }
  }

  async function save(id: string) {
    setBusy(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/categories/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(edits[id]),
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
    <div className="space-y-4">
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <form
        onSubmit={add}
        className="flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-3"
      >
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">
            Tên danh mục
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">
            Mô tả
          </label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-64 rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={busy === "__add__"}
          className="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
        >
          + Thêm
        </button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-3 py-2">Tên</th>
              <th className="px-3 py-2">Mô tả</th>
              <th className="px-3 py-2">Kích hoạt</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {categories.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-3 py-2">
                  <input
                    value={edits[c.id]?.name ?? ""}
                    onChange={(e) =>
                      setEdits((p) => ({
                        ...p,
                        [c.id]: { ...p[c.id], name: e.target.value },
                      }))
                    }
                    className="rounded border border-gray-300 px-2 py-1 text-sm"
                  />
                </td>
                <td className="px-3 py-2 text-gray-500">
                  {c.description ?? "—"}
                </td>
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={edits[c.id]?.is_active ?? false}
                    onChange={(e) =>
                      setEdits((p) => ({
                        ...p,
                        [c.id]: { ...p[c.id], is_active: e.target.checked },
                      }))
                    }
                  />
                </td>
                <td className="px-3 py-2">
                  <button
                    onClick={() => save(c.id)}
                    disabled={busy === c.id}
                    className="rounded-lg bg-brand px-3 py-1 text-xs font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
                  >
                    {busy === c.id ? "…" : "Lưu"}
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
