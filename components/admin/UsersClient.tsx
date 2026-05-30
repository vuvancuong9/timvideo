"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ROLES, ROLE_LABELS, type UserRole } from "@/lib/constants";
import { Badge } from "@/components/ui";
import { formatDate } from "@/lib/format";

type UserRow = {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string;
};

export function UsersClient({
  users,
  currentUserId,
}: {
  users: UserRow[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [roles, setRoles] = useState<Record<string, UserRole>>(() =>
    Object.fromEntries(users.map((u) => [u.id, u.role])),
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save(id: string) {
    setBusy(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${id}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: roles[id] }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Đổi quyền thất bại");
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Có lỗi xảy ra");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-3 py-2">Họ tên</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Quyền</th>
              <th className="px-3 py-2">Trạng thái</th>
              <th className="px-3 py-2">Ngày tạo</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map((u) => {
              const changed = roles[u.id] !== u.role;
              return (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2">
                    {u.full_name || "—"}
                    {u.id === currentUserId && (
                      <span className="ml-1 text-xs text-gray-400">(bạn)</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-gray-600">{u.email}</td>
                  <td className="px-3 py-2">
                    <select
                      value={roles[u.id]}
                      onChange={(e) =>
                        setRoles((p) => ({
                          ...p,
                          [u.id]: e.target.value as UserRole,
                        }))
                      }
                      className="rounded border border-gray-300 px-2 py-1 text-sm"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    {u.is_active ? (
                      <Badge color="green">Hoạt động</Badge>
                    ) : (
                      <Badge color="red">Khóa</Badge>
                    )}
                  </td>
                  <td className="px-3 py-2 text-gray-500">
                    {formatDate(u.created_at)}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => save(u.id)}
                      disabled={!changed || busy === u.id}
                      className="rounded-lg bg-brand px-3 py-1 text-xs font-semibold text-white hover:bg-brand-dark disabled:opacity-40"
                    >
                      {busy === u.id ? "…" : "Lưu"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
