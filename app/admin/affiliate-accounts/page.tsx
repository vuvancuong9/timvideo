import { requireRole } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AffiliateAccountsClient } from "@/components/admin/AffiliateAccountsClient";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AdminAffiliateAccountsPage() {
  await requireRole(["admin"]);
  const supabase = await createSupabaseServerClient();
  const { data: accounts } = await supabase
    .from("affiliate_accounts")
    .select("id,code,name,platform,note,is_active")
    .order("code");

  return (
    <div>
      <PageHeader
        title="Tài khoản affiliate"
        description="Quản lý tài khoản affiliate."
      />
      <AffiliateAccountsClient accounts={accounts ?? []} />
    </div>
  );
}
