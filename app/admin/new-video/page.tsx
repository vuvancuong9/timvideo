import { requireRole } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NewVideoIntakeForm } from "@/components/video-intake/NewVideoIntakeForm";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AdminNewVideoPage() {
  await requireRole(["admin"]);
  const supabase = await createSupabaseServerClient();
  const { data: categories } = await supabase
    .from("product_categories")
    .select("id,name")
    .eq("is_active", true)
    .order("name");

  return (
    <div>
      <PageHeader
        title="Nhập video mới (admin)"
        description="Admin có thể tự tạo video. Sau khi tạo sẽ vào hàng đợi chấm điểm như nhân viên."
      />
      <NewVideoIntakeForm
        categories={categories ?? []}
        redirectTo="/admin/video-reviews"
      />
    </div>
  );
}
