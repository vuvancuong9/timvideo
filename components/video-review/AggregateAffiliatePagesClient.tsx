"use client";

import { Fragment, useState } from "react";
import { Badge } from "@/components/ui";
import {
  FacebookPagesManager,
  type FacebookPage,
} from "@/components/admin/FacebookPagesManager";

type Account = {
  id: string;
  code: string;
  name: string;
  platform: string;
  note: string | null;
  is_active: boolean;
};

/**
 * Trang affiliate cho aggregator (tổng hợp): tài khoản chỉ XEM (sửa account là
 * quyền admin), nhưng Facebook Page thì aggregator được thêm/sửa/xóa (API guard
 * ['aggregator','admin']).
 */
export function AggregateAffiliatePagesClient({
  accounts,
  pagesByAccount,
}: {
  accounts: Account[];
  pagesByAccount: Record<string, FacebookPage[]>;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
          <tr>
            <th className="px-3 py-2">Mã</th>
            <th className="px-3 py-2">Tên</th>
            <th className="px-3 py-2">Nền tảng</th>
            <th className="px-3 py-2">Ghi chú</th>
            <th className="px-3 py-2">Trạng thái</th>
            <th className="px-3 py-2">Facebook Pages</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {accounts.map((a) => (
            <Fragment key={a.id}>
              <tr className="hover:bg-gray-50">
                <td className="px-3 py-2 font-medium">{a.code}</td>
                <td className="px-3 py-2">{a.name}</td>
                <td className="px-3 py-2 text-gray-600">{a.platform}</td>
                <td className="px-3 py-2 text-gray-500">{a.note ?? "—"}</td>
                <td className="px-3 py-2">
                  {a.is_active ? (
                    <Badge color="green">Hoạt động</Badge>
                  ) : (
                    <Badge color="gray">Tắt</Badge>
                  )}
                </td>
                <td className="px-3 py-2">
                  <button
                    onClick={() =>
                      setExpanded((cur) => (cur === a.id ? null : a.id))
                    }
                    className="rounded-lg border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
                  >
                    {(pagesByAccount[a.id]?.length ?? 0)} page
                    {expanded === a.id ? " ▲" : " ▼"}
                  </button>
                </td>
              </tr>
              {expanded === a.id && (
                <tr>
                  <td colSpan={6} className="px-3 pb-3">
                    <FacebookPagesManager
                      accountId={a.id}
                      initialPages={pagesByAccount[a.id] ?? []}
                    />
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
