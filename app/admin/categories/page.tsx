import { requireRole } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CategoriesClient } from "@/components/admin/CategoriesClient";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AdminCategoriesPage() {
  await requireRole(["admin"]);
  const supabase = await createSupabaseServerClient();
  const { data: categories } = await supabase
    .from("product_categories")
    .select("id,name,description,is_active")
    .order("name");

  return (
    <div>
      <PageHeader title="Danh mục sản phẩm" description="Quản lý danh mục." />
      <CategoriesClient categories={categories ?? []} />
    </div>
  );
}
