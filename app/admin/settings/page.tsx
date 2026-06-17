import { requireRole } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getManagedSettingsStatus } from "@/lib/app-settings";
import { isDriveOAuthConnected } from "@/lib/drive-oauth";
import { IntegrationSettingsClient } from "@/components/admin/IntegrationSettingsClient";
import { SalesImportClient } from "@/components/admin/SalesImportClient";
import { SheetBackfillButton } from "@/components/admin/SheetBackfillButton";
import { Badge, Card, PageHeader } from "@/components/ui";
import { ROLE_LABELS } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ google?: string; reason?: string }>;
}) {
  await requireRole(["admin"]);
  const { google: googleStatus, reason: googleReason } = await searchParams;

  const { managed, system } = await getManagedSettingsStatus();
  const driveConnected = await isDriveOAuthConnected();

  const supabase = await createSupabaseServerClient();
  const { data: employees } = await supabase
    .from("profiles")
    .select("id,full_name,email,role")
    .order("full_name");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cấu hình & API"
        description="Quản lý API key, Google Drive, Google Sheet (chỉ admin)."
      />

      {/* API keys & tích hợp — DB-backed, chỉ admin */}
      <section>
        <h2 className="mb-3 text-lg font-bold text-gray-900">
          API keys & tích hợp
        </h2>
        <IntegrationSettingsClient managed={managed} />
      </section>

      {/* Kết nối Google Drive cá nhân để lưu video */}
      <Card>
        <h2 className="mb-2 font-semibold text-gray-900">
          Lưu video vào Google Drive của bạn
        </h2>
        {googleStatus === "connected" && (
          <p className="mb-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
            ✅ Đã kết nối Google Drive thành công! Video tải lên từ giờ sẽ lưu
            vào Drive của bạn.
          </p>
        )}
        {googleStatus === "error" && (
          <div className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            ❌ Kết nối thất bại. Kiểm tra Client ID/Secret + Redirect URI rồi thử
            lại.
            {googleReason && (
              <div className="mt-1 font-mono text-xs text-red-500">
                Lý do: {googleReason}
                {googleReason === "redirect_uri_mismatch" && (
                  <span className="block font-sans text-red-600">
                    → Vào Google Cloud → Credentials → OAuth client → thêm đúng
                    Authorized redirect URI:{" "}
                    {`${"https://timvideo.vercel.app"}/api/auth/google/callback`}
                  </span>
                )}
                {googleReason === "NO_REFRESH_TOKEN" && (
                  <span className="block font-sans text-red-600">
                    → Google không trả refresh token. Gỡ quyền cũ tại
                    myaccount.google.com/permissions rồi bấm Kết nối lại.
                  </span>
                )}
                {googleReason === "access_denied" && (
                  <span className="block font-sans text-red-600">
                    → Bạn đã bấm Hủy/Deny ở màn hình Google, hoặc email chưa nằm
                    trong Test users (nếu app để Testing). Thử lại và bấm Allow.
                  </span>
                )}
              </div>
            )}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-gray-600">Trạng thái:</span>
          {driveConnected ? (
            <Badge color="green">Đã kết nối</Badge>
          ) : (
            <Badge color="gray">Chưa kết nối</Badge>
          )}
          <a
            href="/api/auth/google/start"
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
          >
            {driveConnected ? "Kết nối lại" : "Kết nối Google Drive"}
          </a>
        </div>
        <p className="mt-2 text-xs text-gray-400">
          Cần nhập GOOGLE_OAUTH_CLIENT_ID + SECRET ở trên trước. Nếu CHƯA kết
          nối, video sẽ tự lưu vào Supabase Storage (vẫn có link xem). Khi đã
          kết nối, video lưu vào Drive cá nhân của bạn (dùng quota của bạn).
        </p>
      </Card>

      {/* Trạng thái hạ tầng (env Vercel, read-only) */}
      <Card>
        <h2 className="mb-3 font-semibold text-gray-900">
          Hạ tầng (đặt ở Vercel env — chỉ xem)
        </h2>
        <ul className="space-y-2 text-sm">
          {system.map((s) => (
            <li key={s.key} className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-gray-700">{s.label}</span>
              <code className="text-xs text-gray-400">{s.key}</code>
              {s.hasValue ? (
                <Badge color="green">Đã cấu hình</Badge>
              ) : (
                <Badge color="red">Chưa cấu hình</Badge>
              )}
              {s.preview && (
                <span className="font-mono text-xs text-gray-400">
                  {s.preview}
                </span>
              )}
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <h2 className="mb-2 font-semibold text-gray-900">
          Đồng bộ link video Drive vào Google Sheet
        </h2>
        <p className="mb-3 text-sm text-gray-500">
          Điền link video trên Drive vào cột “File video” cho các dòng còn
          trống (lấy từ database). Dòng đã có link giữ nguyên; dòng chỉ-có-link
          (không tải file) sẽ bỏ qua. Chạy lại bất cứ lúc nào.
        </p>
        <SheetBackfillButton />
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
