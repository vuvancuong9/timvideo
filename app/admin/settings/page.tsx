import { requireRole } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SalesImportClient } from "@/components/admin/SalesImportClient";
import { Badge, Card, PageHeader } from "@/components/ui";
import { ROLE_LABELS } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  await requireRole(["admin"]);

  const driveConfigured = Boolean(
    process.env.GOOGLE_DRIVE_CLIENT_EMAIL &&
      process.env.GOOGLE_DRIVE_PRIVATE_KEY &&
      process.env.GOOGLE_DRIVE_FOLDER_ID,
  );
  const adminEmailCount = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean).length;

  const supabase = await createSupabaseServerClient();
  const { data: employees } = await supabase
    .from("profiles")
    .select("id,full_name,email,role")
    .order("full_name");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cấu hình hệ thống"
        description="Trạng thái cấu hình & nhập doanh số."
      />

      <Card>
        <h2 className="mb-3 font-semibold text-gray-900">Trạng thái cấu hình</h2>
        <ul className="space-y-2 text-sm">
          <li className="flex items-center gap-2">
            Google Drive:{" "}
            {driveConfigured ? (
              <Badge color="green">Đã cấu hình</Badge>
            ) : (
              <Badge color="red">Chưa cấu hình</Badge>
            )}
          </li>
          <li className="flex items-center gap-2">
            Số email admin (ADMIN_EMAILS):{" "}
            <span className="font-semibold">{adminEmailCount}</span>
          </li>
        </ul>
      </Card>

      <Card>
        <h2 className="mb-3 font-semibold text-gray-900">Nhập doanh số (CSV)</h2>
        <SalesImportClient />
      </Card>

      <Card>
        <h2 className="mb-3 font-semibold text-gray-900">
          Tham chiếu ID nhân viên
        </h2>
        <p className="mb-3 text-sm text-gray-500">
          Dùng các ID này cho cột <code>employee_id</code> khi nhập doanh số.
        </p>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-2">Họ tên</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Quyền</th>
                <th className="px-3 py-2">ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(employees ?? []).map((e) => (
                <tr key={e.id}>
                  <td className="px-3 py-2">{e.full_name || "—"}</td>
                  <td className="px-3 py-2 text-gray-600">{e.email}</td>
                  <td className="px-3 py-2">{ROLE_LABELS[e.role]}</td>
                  <td className="px-3 py-2 font-mono text-xs text-gray-500">
                    {e.id}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
