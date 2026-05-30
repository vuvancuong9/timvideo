import { requireRole } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { ROLE_LABELS } from "@/lib/constants";
import { formatDate, formatNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function EmployeesPage() {
  await requireRole(["accountant"]);
  const supabase = await createSupabaseServerClient();

  const [{ data: users }, { data: creators }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id,email,full_name,role,is_active,created_at")
      .order("created_at", { ascending: true }),
    supabase.from("video_submissions").select("created_by"),
  ]);

  const countByUser = new Map<string, number>();
  for (const v of creators ?? []) {
    countByUser.set(v.created_by, (countByUser.get(v.created_by) ?? 0) + 1);
  }

  return (
    <div>
      <PageHeader
        title="Nhân viên"
        description="Danh sách toàn bộ người dùng (chỉ xem)."
      />
      {!users || users.length === 0 ? (
        <EmptyState message="Chưa có người dùng nào." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-2">Họ tên</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Quyền</th>
                <th className="px-3 py-2">Trạng thái</th>
                <th className="px-3 py-2">Số video</th>
                <th className="px-3 py-2">Ngày tạo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2">{u.full_name || "—"}</td>
                  <td className="px-3 py-2 text-gray-600">{u.email}</td>
                  <td className="px-3 py-2">{ROLE_LABELS[u.role]}</td>
                  <td className="px-3 py-2">
                    {u.is_active ? (
                      <Badge color="green">Hoạt động</Badge>
                    ) : (
                      <Badge color="red">Khóa</Badge>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {formatNumber(countByUser.get(u.id) ?? 0)}
                  </td>
                  <td className="px-3 py-2 text-gray-500">
                    {formatDate(u.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
