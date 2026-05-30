import { Constants } from "@/lib/database.types";
import { VIDEO_SOURCE_LABELS, VIDEO_STATUS_LABELS } from "@/lib/constants";

export function VideoFilters({
  categories,
  current,
  extra = {},
  showAssigned = false,
}: {
  categories: { id: string; name: string }[];
  current: {
    q?: string;
    status?: string;
    source?: string;
    category_id?: string;
    assigned?: string;
  };
  extra?: Record<string, string>;
  showAssigned?: boolean;
}) {
  return (
    <form
      method="get"
      className="flex flex-wrap items-end gap-2 rounded-xl border border-gray-200 bg-white p-3"
    >
      {Object.entries(extra).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <input
        name="q"
        defaultValue={current.q}
        placeholder="Tìm link sản phẩm / video…"
        className="w-56 rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
      />
      <select
        name="status"
        defaultValue={current.status ?? ""}
        className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
      >
        <option value="">Mọi trạng thái</option>
        {Constants.public.Enums.video_status.map((s) => (
          <option key={s} value={s}>
            {VIDEO_STATUS_LABELS[s]}
          </option>
        ))}
      </select>
      <select
        name="source"
        defaultValue={current.source ?? ""}
        className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
      >
        <option value="">Mọi nguồn</option>
        {Constants.public.Enums.video_source.map((s) => (
          <option key={s} value={s}>
            {VIDEO_SOURCE_LABELS[s]}
          </option>
        ))}
      </select>
      <select
        name="category_id"
        defaultValue={current.category_id ?? ""}
        className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
      >
        <option value="">Mọi danh mục</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      {showAssigned && (
        <select
          name="assigned"
          defaultValue={current.assigned ?? ""}
          className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
        >
          <option value="">Tất cả</option>
          <option value="unassigned">Chưa phân affiliate</option>
          <option value="assigned">Đã phân affiliate</option>
        </select>
      )}
      <button
        type="submit"
        className="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-dark"
      >
        Lọc
      </button>
    </form>
  );
}
