"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, type BadgeColor } from "@/components/ui";

type SettingStatus = {
  key: string;
  label: string;
  group: string;
  isSecret: boolean;
  multiline: boolean;
  placeholder: string | null;
  help: string | null;
  guide: string[];
  guideUrl: string | null;
  guideUrlLabel: string | null;
  hasValue: boolean;
  source: "db" | "env" | "none";
  preview: string | null;
};

const SOURCE_BADGE: Record<
  SettingStatus["source"],
  { color: BadgeColor; text: string }
> = {
  db: { color: "green", text: "Đã lưu (DB)" },
  env: { color: "blue", text: "Từ Vercel env" },
  none: { color: "red", text: "Chưa cấu hình" },
};

function SettingGuide({ s }: { s: SettingStatus }) {
  if (s.guide.length === 0 && !s.guideUrl) return null;
  return (
    <details className="mt-1 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
      <summary className="cursor-pointer select-none font-medium text-brand">
        📖 Cách lấy {s.label}
      </summary>
      <div className="mt-2 space-y-2">
        {s.guide.length > 0 && (
          <ol className="list-inside list-decimal space-y-1">
            {s.guide.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        )}
        {s.guideUrl && (
          <a
            href={s.guideUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-medium text-brand hover:underline"
          >
            → Mở {s.guideUrlLabel ?? s.guideUrl}
          </a>
        )}
      </div>
    </details>
  );
}

export function IntegrationSettingsClient({
  managed,
}: {
  managed: SettingStatus[];
}) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const groups = Array.from(new Set(managed.map((m) => m.group)));

  function setVal(key: string, v: string) {
    setValues((p) => ({ ...p, [key]: v }));
  }

  async function save() {
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const payload = Object.fromEntries(
        Object.entries(values).filter(([, v]) => v.trim().length > 0),
      );
      if (Object.keys(payload).length === 0) {
        setError("Chưa nhập giá trị mới nào.");
        setBusy(false);
        return;
      }
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values: payload }),
      });
      const j = await res.json();
      if (!res.ok) {
        throw new Error(
          [j.error, j.detail].filter(Boolean).join(" — ") || "Lưu thất bại",
        );
      }
      setMsg(`Đã lưu ${j.updated?.length ?? 0} mục.`);
      setValues({});
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Có lỗi xảy ra");
    } finally {
      setBusy(false);
    }
  }

  async function clearKey(key: string) {
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clear: [key] }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Xoá thất bại");
      setMsg(`Đã xoá ${key} khỏi DB (sẽ fallback về env nếu có).`);
      setValues((p) => {
        const next = { ...p };
        delete next[key];
        return next;
      });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Có lỗi xảy ra");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <p className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        🔒 Giá trị secret được lưu trong DB (chỉ admin truy cập), chỉ hiển thị
        dạng che (••••). Để trống một ô = giữ nguyên giá trị cũ. Thay đổi áp
        dụng ngay, không cần redeploy. Bấm “📖 Cách lấy” dưới mỗi ô để xem hướng
        dẫn.
      </p>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {msg && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
          {msg}
        </p>
      )}

      {groups.map((group) => (
        <div
          key={group}
          className="rounded-xl border border-gray-200 bg-white p-4"
        >
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
            {group}
          </h3>
          <div className="space-y-5">
            {managed
              .filter((m) => m.group === group)
              .map((m) => (
                <div key={m.key}>
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <label className="text-sm font-medium text-gray-700">
                      {m.label}
                    </label>
                    <Badge color={SOURCE_BADGE[m.source].color}>
                      {SOURCE_BADGE[m.source].text}
                    </Badge>
                    {m.preview && (
                      <span className="font-mono text-xs text-gray-400">
                        {m.preview}
                      </span>
                    )}
                  </div>
                  {m.multiline ? (
                    <textarea
                      value={values[m.key] ?? ""}
                      onChange={(e) => setVal(m.key, e.target.value)}
                      rows={3}
                      placeholder={
                        m.hasValue
                          ? "Để trống nếu giữ nguyên…"
                          : (m.placeholder ?? "")
                      }
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-xs outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                    />
                  ) : (
                    <input
                      type={m.isSecret ? "password" : "text"}
                      autoComplete="off"
                      value={values[m.key] ?? ""}
                      onChange={(e) => setVal(m.key, e.target.value)}
                      placeholder={
                        m.hasValue
                          ? "Để trống nếu giữ nguyên…"
                          : (m.placeholder ?? "")
                      }
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                    />
                  )}
                  <div className="mt-1 flex items-start justify-between gap-2">
                    {m.help ? (
                      <p className="text-xs text-gray-400">{m.help}</p>
                    ) : (
                      <span />
                    )}
                    {m.source === "db" && (
                      <button
                        type="button"
                        onClick={() => clearKey(m.key)}
                        disabled={busy}
                        className="shrink-0 text-xs text-red-500 hover:underline disabled:opacity-50"
                      >
                        Xoá khỏi DB
                      </button>
                    )}
                  </div>
                  <SettingGuide s={m} />
                </div>
              ))}
          </div>
        </div>
      ))}

      <button
        onClick={save}
        disabled={busy}
        className="rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
      >
        {busy ? "Đang lưu…" : "Lưu cấu hình"}
      </button>
    </div>
  );
}
