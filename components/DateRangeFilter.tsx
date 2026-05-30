/** Bộ lọc khoảng ngày dạng GET form (server component, không cần JS). */
export function DateRangeFilter({
  from,
  to,
  hidden = {},
}: {
  from?: string;
  to?: string;
  hidden?: Record<string, string>;
}) {
  return (
    <form method="get" className="flex flex-wrap items-end gap-3">
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-500">
          Từ ngày
        </label>
        <input
          type="date"
          name="from"
          defaultValue={from}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-500">
          Đến ngày
        </label>
        <input
          type="date"
          name="to"
          defaultValue={to}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
        />
      </div>
      <button
        type="submit"
        className="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-dark"
      >
        Lọc
      </button>
    </form>
  );
}
