import { SourceBadge, StatusBadge } from "@/components/ui";
import { formatCurrency, formatDateTime, formatPercent } from "@/lib/format";
import type { VideoRow } from "@/lib/videos";

export type VideoTableColumns = {
  employee?: boolean;
  affiliate?: boolean;
  shortLink?: boolean;
};

export function VideoTable({
  rows,
  show = {},
}: {
  rows: VideoRow[];
  show?: VideoTableColumns;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
          <tr>
            <Th>Ngày tạo</Th>
            <Th>Sản phẩm</Th>
            <Th>Giá</Th>
            <Th>%</Th>
            <Th>HH dự kiến</Th>
            <Th>Nguồn</Th>
            <Th>Danh mục</Th>
            {show.employee && <Th>Nhân viên</Th>}
            {show.affiliate && <Th>Affiliate</Th>}
            <Th>Trạng thái</Th>
            {show.shortLink && <Th>Link rút gọn</Th>}
            <Th>Drive</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((v) => (
            <tr key={v.id} className="hover:bg-gray-50">
              <Td className="whitespace-nowrap text-gray-500">
                {formatDateTime(v.created_at)}
              </Td>
              <Td>
                <a
                  href={v.shopee_product_url}
                  target="_blank"
                  rel="noreferrer"
                  title={v.shopee_product_url}
                  className="block max-w-[220px] truncate text-brand hover:underline"
                >
                  {v.shopee_product_url}
                </a>
              </Td>
              <Td className="whitespace-nowrap">{formatCurrency(v.product_price)}</Td>
              <Td className="whitespace-nowrap">
                {formatPercent(v.commission_percent)}
              </Td>
              <Td className="whitespace-nowrap">
                {formatCurrency(v.estimated_commission)}
              </Td>
              <Td>
                <SourceBadge source={v.video_source} />
              </Td>
              <Td className="whitespace-nowrap text-gray-600">
                {v.category?.name ?? "—"}
              </Td>
              {show.employee && (
                <Td className="whitespace-nowrap text-gray-600">
                  {v.creator?.full_name || v.creator?.email || "—"}
                </Td>
              )}
              {show.affiliate && (
                <Td className="whitespace-nowrap text-gray-600">
                  {v.affiliate ? `${v.affiliate.code}` : "—"}
                </Td>
              )}
              <Td>
                <StatusBadge status={v.status} />
              </Td>
              {show.shortLink && (
                <Td>
                  {v.short_link ? (
                    <a
                      href={v.short_link}
                      target="_blank"
                      rel="noreferrer"
                      className="text-brand hover:underline"
                    >
                      Link
                    </a>
                  ) : (
                    "—"
                  )}
                </Td>
              )}
              <Td>
                {v.drive_web_url ? (
                  <a
                    href={v.drive_web_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-brand hover:underline"
                  >
                    Xem
                  </a>
                ) : (
                  "—"
                )}
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-2">{children}</th>;
}

function Td({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-3 py-2 ${className}`}>{children}</td>;
}
