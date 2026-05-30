import { requireRole } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NewVideoForm } from "@/components/NewVideoForm";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function NewVideoPage() {
  await requireRole(["staff"]);
  const supabase = await createSupabaseServerClient();
  const { data: categories } = await supabase
    .from("product_categories")
    .select("id,name")
    .eq("is_active", true)
    .order("name");

  return (
    <div>
      <PageHeader
        title="Nhập video mới"
        description="Điền thông tin sản phẩm và link video bạn tìm được."
      />
      <NewVideoForm categories={categories ?? []} />
    </div>
  );
}
