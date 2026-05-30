import { requireRole } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { EmptyState, PageHeader } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import type { Database } from "@/lib/database.types";

export const dynamic = "force-dynamic";

type AuditLogRow = Database["public"]["Tables"]["audit_logs"]["Row"] & {
  actor: { full_name: string | null; email: string } | null;
};

export default async function AuditLogsPage() {
  await requireRole(["admin"]);
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("audit_logs")
    .select("*, actor:profiles!audit_logs_actor_id_fkey(full_name,email)")
    .order("created_at", { ascending: false })
    .limit(300);

  const logs = (data ?? []) as unknown as AuditLogRow[];

  return (
    <div>
      <PageHeader
        title="Audit log"
        description="Nhật ký các hành động quan trọng (300 bản ghi gần nhất)."
      />
      {logs.length === 0 ? (
        <EmptyState message="Chưa có nhật ký." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-2">Thời gian</th>
                <th className="px-3 py-2">Người thực hiện</th>
                <th className="px-3 py-2">Hành động</th>
                <th className="px-3 py-2">Đối tượng</th>
                <th className="px-3 py-2">Chi tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.map((l) => (
                <tr key={l.id} className="align-top hover:bg-gray-50">
                  <td className="whitespace-nowrap px-3 py-2 text-gray-500">
                    {formatDateTime(l.created_at)}
                  </td>
                  <td className="px-3 py-2 text-gray-600">
                    {l.actor?.full_name || l.actor?.email || "—"}
                  </td>
                  <td className="px-3 py-2 font-medium">{l.action}</td>
                  <td className="px-3 py-2 text-gray-500">
                    {l.entity_type}
                    {l.entity_id ? (
                      <span className="block text-xs text-gray-400">
                        {l.entity_id.slice(0, 8)}…
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">
                    {l.after_data ? (
                      <code className="block max-w-[320px] truncate text-xs text-gray-500">
                        {JSON.stringify(l.after_data)}
                      </code>
                    ) : (
                      "—"
                    )}
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
