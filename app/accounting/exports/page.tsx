import { requireRole } from "@/lib/auth/session";
import { Card, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

const BASE = "/api/accounting/exports";

function ExportLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
    >
      {label}
    </a>
  );
}

export default async function ExportsPage() {
  await requireRole(["accountant"]);
  return (
    <div>
      <PageHeader
        title="Xuất dữ liệu"
        description="Tải dữ liệu dạng CSV hoặc XLSX."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold text-gray-900">Video / Link</h2>
          <div className="flex gap-3">
            <ExportLink href={`${BASE}?type=videos&format=csv`} label="Tải CSV" />
            <ExportLink
              href={`${BASE}?type=videos&format=xlsx`}
              label="Tải XLSX"
            />
          </div>
        </Card>
        <Card>
          <h2 className="mb-3 font-semibold text-gray-900">Doanh số</h2>
          <div className="flex gap-3">
            <ExportLink href={`${BASE}?type=sales&format=csv`} label="Tải CSV" />
            <ExportLink
              href={`${BASE}?type=sales&format=xlsx`}
              label="Tải XLSX"
            />
          </div>
        </Card>
      </div>
    </div>
  );
}
