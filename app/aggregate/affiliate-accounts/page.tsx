import { requireRole } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { EmptyState, PageHeader } from "@/components/ui";
import { AggregateAffiliatePagesClient } from "@/components/video-review/AggregateAffiliatePagesClient";

export const dynamic = "force-dynamic";

export default async function AggregateAffiliateAccountsPage() {
  await requireRole(["aggregator"]);
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
        description="Xem tài khoản affiliate và quản lý Facebook Page liên kết."
      />
      {!accounts || accounts.length === 0 ? (
        <EmptyState message="Chưa có tài khoản affiliate nào." />
      ) : (
        <AggregateAffiliatePagesClient
          accounts={accounts}
          pagesByAccount={pagesByAccount}
        />
      )}
    </div>
  );
}
