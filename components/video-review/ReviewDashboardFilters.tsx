import { Constants } from "@/lib/database.types";
import {
  SOURCE_TYPE_LABELS,
  SUBMISSION_STATUS_LABELS,
  FINAL_ACTION_LABELS,
  RISK_LABELS,
} from "@/lib/video-intake/labels";

export function ReviewDashboardFilters({
  current,
}: {
  current: {
    q?: string;
    status?: string;
    source_type?: string;
    final_action?: string;
    policy_risk?: string;
  };
}) {
  return (
    <form
      method="get"
      className="flex flex-wrap items-end gap-2 rounded-xl border border-gray-200 bg-white p-3"
    >
      <input
        name="q"
        defaultValue={current.q}
        placeholder="Tìm link…"
        className="w-48 rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
      />
      <select
        name="status"
        defaultValue={current.status ?? ""}
        className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
      >
        <option value="">Mọi trạng thái</option>
        {Constants.public.Enums.video_submission_status.map((s) => (
          <option key={s} value={s}>
            {SUBMISSION_STATUS_LABELS[s]}
          </option>
        ))}
      </select>
      <select
        name="source_type"
        defaultValue={current.source_type ?? ""}
        className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
      >
        <option value="">Mọi nguồn</option>
        {Constants.public.Enums.video_source_type.map((s) => (
          <option key={s} value={s}>
            {SOURCE_TYPE_LABELS[s]}
          </option>
        ))}
      </select>
      <select
        name="final_action"
        defaultValue={current.final_action ?? ""}
        className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
      >
        <option value="">Mọi hành động</option>
        {Constants.public.Enums.video_final_action.map((s) => (
          <option key={s} value={s}>
            {FINAL_ACTION_LABELS[s]}
          </option>
        ))}
      </select>
      <select
        name="policy_risk"
        defaultValue={current.policy_risk ?? ""}
        className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
      >
        <option value="">Mọi mức rủi ro</option>
        {Constants.public.Enums.risk_level.map((s) => (
          <option key={s} value={s}>
            {RISK_LABELS[s]}
          </option>
        ))}
      </select>
      <button
        type="submit"
        className="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-dark"
      >
        Lọc
      </button>
    </form>
  );
}
