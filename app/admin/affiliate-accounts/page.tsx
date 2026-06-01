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

  const { data: pages } = await supabase
    .from("facebook_pages")
    .select("*")
    .order("created_at", { ascending: true });

  const pagesByAccount: Record<string, NonNullable<typeof pages>> = {};
  for (const p of pages ?? []) {
    (pagesByAccount[p.affiliate_account_id] ??= []).push(p);
  }

  return (
    <div>
      <PageHeader
        title="Tài khoản affiliate"
        description="Quản lý tài khoản affiliate và Facebook Page liên kết."
      />
      <AffiliateAccountsClient
        accounts={accounts ?? []}
        pagesByAccount={pagesByAccount}
      />
    </div>
  );
}
