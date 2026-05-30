import { requireRole } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { UsersClient } from "@/components/admin/UsersClient";
import { EmptyState, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const session = await requireRole(["admin"]);
  const supabase = await createSupabaseServerClient();
  const { data: users } = await supabase
    .from("profiles")
    .select("id,email,full_name,role,is_active,created_at")
    .order("created_at", { ascending: true });

  return (
    <div>
      <PageHeader
        title="Người dùng & quyền"
        description="Phân quyền cho từng tài khoản."
      />
      {!users || users.length === 0 ? (
        <EmptyState message="Chưa có người dùng nào." />
      ) : (
        <UsersClient users={users} currentUserId={session.userId} />
      )}
    </div>
  );
}
