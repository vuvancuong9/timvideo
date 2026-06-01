import Link from "next/link";
import { Badge } from "@/components/ui";
import { formatCurrency, formatDateTime } from "@/lib/format";
import {
  SOURCE_TYPE_LABELS,
  SUBMISSION_STATUS_LABELS,
  STATUS_COLORS,
} from "@/lib/video-intake/labels";
import type { SubmissionWithRelations } from "@/lib/video-intake/queries";

export type SubmissionTableColumns = {
  employee?: boolean;
  affiliate?: boolean;
  shortLink?: boolean;
};

export function SubmissionTable({
  rows,
  show = {},
  reviewHrefBase,
}: {
  rows: SubmissionWithRelations[];
  show?: SubmissionTableColumns;
  /** nếu set, cột "Sản phẩm" link tới `${base}/${id}` (trang review). */
  reviewHrefBase?: string;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
          <tr>
            <Th>Ngày tạo</Th>
            <Th>Tên sản phẩm</Th>
            <Th>Link Shopee</Th>
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
                {reviewHrefBase ? (
                  <Link
                    href={`${reviewHrefBase}/${v.id}`}
                    className="block max-w-[240px] truncate font-medium text-brand hover:underline"
                    title={v.product_name ?? undefined}
                  >
                    {v.product_name || "(chưa có tên)"}
                  </Link>
                ) : (
                  <span
                    className="block max-w-[240px] truncate font-medium text-gray-800"
                    title={v.product_name ?? undefined}
                  >
                    {v.product_name || "(chưa có tên)"}
                  </span>
                )}
              </Td>
              <Td>
                <a
                  href={v.shopee_product_url}
                  target="_blank"
                  rel="noreferrer"
                  title={v.shopee_product_url}
                  className="block max-w-[200px] truncate text-brand hover:underline"
                >
                  {v.shopee_product_url}
                </a>
              </Td>
              <Td className="whitespace-nowrap">
                {formatCurrency(v.product_price)}
              </Td>
              <Td className="whitespace-nowrap">{v.commission_percent}%</Td>
              <Td className="whitespace-nowrap">
                {formatCurrency(v.estimated_commission)}
              </Td>
              <Td>
                <Badge color="gray">{SOURCE_TYPE_LABELS[v.source_type]}</Badge>
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
                  {v.affiliate ? v.affiliate.code : "—"}
                </Td>
              )}
              <Td>
                <Badge color={STATUS_COLORS[v.status]}>
                  {SUBMISSION_STATUS_LABELS[v.status]}
                </Badge>
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
