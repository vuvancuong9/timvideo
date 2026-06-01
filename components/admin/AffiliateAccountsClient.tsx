"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FacebookPagesManager,
  type FacebookPage,
} from "@/components/admin/FacebookPagesManager";

type Account = {
  id: string;
  code: string;
  name: string;
  platform: string;
  note: string | null;
  is_active: boolean;
};

export function AffiliateAccountsClient({
  accounts,
  pagesByAccount = {},
}: {
  accounts: Account[];
  pagesByAccount?: Record<string, FacebookPage[]>;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [form, setForm] = useState({
    code: "",
    name: "",
    platform: "shopee",
    note: "",
  });
  const [edits, setEdits] = useState<
    Record<string, { name: string; note: string; is_active: boolean }>
  >(() =>
    Object.fromEntries(
      accounts.map((a) => [
        a.id,
        { name: a.name, note: a.note ?? "", is_active: a.is_active },
      ]),
    ),
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!form.code.trim() || !form.name.trim()) return;
    setBusy("__add__");
    setError(null);
    try {
      const res = await fetch("/api/admin/affiliate-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Thêm tài khoản thất bại");
      }
      setForm({ code: "", name: "", platform: "shopee", note: "" });
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
      const res = await fetch(`/api/admin/affiliate-accounts/${id}`, {
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

  const inputClass =
    "rounded-lg border border-gray-300 px-3 py-1.5 text-sm";

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
            Mã (code)
          </label>
          <input
            value={form.code}
            onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
            className={inputClass}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">
            Tên
          </label>
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className={inputClass}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">
            Nền tảng
          </label>
          <input
            value={form.platform}
            onChange={(e) =>
              setForm((f) => ({ ...f, platform: e.target.value }))
            }
            className={inputClass}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">
            Ghi chú
          </label>
          <input
            value={form.note}
            onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
            className={`${inputClass} w-48`}
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
              <th className="px-3 py-2">Mã</th>
              <th className="px-3 py-2">Tên</th>
              <th className="px-3 py-2">Nền tảng</th>
              <th className="px-3 py-2">Ghi chú</th>
              <th className="px-3 py-2">Hoạt động</th>
              <th className="px-3 py-2">Facebook Pages</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {accounts.map((a) => (
              <Fragment key={a.id}>
              <tr className="hover:bg-gray-50">
                <td className="px-3 py-2 font-medium">{a.code}</td>
                <td className="px-3 py-2">
                  <input
                    value={edits[a.id]?.name ?? ""}
                    onChange={(e) =>
                      setEdits((p) => ({
                        ...p,
                        [a.id]: { ...p[a.id], name: e.target.value },
                      }))
                    }
                    className="rounded border border-gray-300 px-2 py-1 text-sm"
                  />
                </td>
                <td className="px-3 py-2 text-gray-600">{a.platform}</td>
                <td className="px-3 py-2">
                  <input
                    value={edits[a.id]?.note ?? ""}
                    onChange={(e) =>
                      setEdits((p) => ({
                        ...p,
                        [a.id]: { ...p[a.id], note: e.target.value },
                      }))
                    }
                    className="w-40 rounded border border-gray-300 px-2 py-1 text-sm"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={edits[a.id]?.is_active ?? false}
                    onChange={(e) =>
                      setEdits((p) => ({
                        ...p,
                        [a.id]: { ...p[a.id], is_active: e.target.checked },
                      }))
                    }
                  />
                </td>
                <td className="px-3 py-2">
                  <button
                    onClick={() =>
                      setExpanded((cur) => (cur === a.id ? null : a.id))
                    }
                    className="rounded-lg border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
                  >
                    {(pagesByAccount[a.id]?.length ?? 0)} page
                    {expanded === a.id ? " ▲" : " ▼"}
                  </button>
                </td>
                <td className="px-3 py-2">
                  <button
                    onClick={() => save(a.id)}
                    disabled={busy === a.id}
                    className="rounded-lg bg-brand px-3 py-1 text-xs font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
                  >
                    {busy === a.id ? "…" : "Lưu"}
                  </button>
                </td>
              </tr>
              {expanded === a.id && (
                <tr>
                  <td colSpan={7} className="px-3 pb-3">
                    <FacebookPagesManager
                      accountId={a.id}
                      initialPages={pagesByAccount[a.id] ?? []}
                    />
                  </td>
                </tr>
              )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
