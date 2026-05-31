"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { detectVideoSource } from "@/lib/video-intake/normalize-url";
import { SOURCE_TYPE_LABELS } from "@/lib/video-intake/labels";
import { formatCurrency } from "@/lib/format";
import type { VideoSourceType } from "@/types/videoIntake";

type Category = { id: string; name: string };

type DriveMeta = {
  driveFileId: string;
  driveFileName: string | null;
  driveWebUrl: string | null;
  driveFolderId: string | null;
};

const SOURCE_OPTIONS: VideoSourceType[] = [
  "tiktok_url",
  "facebook_url",
  "youtube_url",
  "drive_upload",
  "other_url",
];

function putFileWithProgress(
  url: string,
  file: File,
  onProgress: (pct: number) => void,
): Promise<{ id?: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url, true);
    xhr.setRequestHeader(
      "Content-Type",
      file.type || "application/octet-stream",
    );
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch {
          resolve({});
        }
      } else {
        reject(new Error(`Upload Drive thất bại (${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new Error("Lỗi mạng khi upload lên Drive"));
    xhr.send(file);
  });
}

export function NewVideoIntakeForm({
  categories,
  redirectTo = "/staff/my-videos",
}: {
  categories: Category[];
  /** Trang chuyển tới sau khi submit thành công. */
  redirectTo?: string;
}) {
  const router = useRouter();

  const [shopeeUrl, setShopeeUrl] = useState("");
  const [price, setPrice] = useState("");
  const [percent, setPercent] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [sourceType, setSourceType] = useState<VideoSourceType>("tiktok_url");
  const [sourceTouched, setSourceTouched] = useState(false);
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const [checking, setChecking] = useState(false);
  const [duplicate, setDuplicate] = useState(false);
  const [dupMsg, setDupMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isDrive = sourceType === "drive_upload";

  // auto-detect nguồn từ URL nếu user chưa chỉnh tay
  useEffect(() => {
    if (sourceTouched || isDrive) return;
    if (videoUrl.trim()) setSourceType(detectVideoSource(videoUrl));
  }, [videoUrl, sourceTouched, isDrive]);

  const estimated = useMemo(() => {
    const p = Number(price);
    const c = Number(percent);
    if (!Number.isFinite(p) || !Number.isFinite(c)) return 0;
    return (p * c) / 100;
  }, [price, percent]);

  const lastChecked = useRef("");

  // debounce 500ms check duplicate
  useEffect(() => {
    const url = videoUrl.trim();
    setDuplicate(false);
    setDupMsg(null);
    if (!url || isDrive) {
      setChecking(false);
      return;
    }
    setChecking(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/video-intake/check-duplicate?url=${encodeURIComponent(url)}`,
        );
        const json = await res.json();
        lastChecked.current = url;
        if (json.duplicate) {
          setDuplicate(true);
          const by = json.existing?.created_by_name
            ? ` (người nhập: ${json.existing.created_by_name})`
            : "";
          setDupMsg(`Video này đã có người nhập rồi${by}.`);
        }
      } catch {
        // bỏ qua, server vẫn chặn khi submit
      } finally {
        setChecking(false);
      }
    }, 500);
    return () => clearTimeout(t);
  }, [videoUrl, isDrive]);

  async function uploadToDrive(f: File): Promise<DriveMeta> {
    setProgress(0);
    const sessionRes = await fetch("/api/uploads/drive/create-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: f.name,
        mimeType: f.type || "application/octet-stream",
        fileSize: f.size,
      }),
    });
    const sessionJson = await sessionRes.json();
    if (!sessionRes.ok) {
      throw new Error(sessionJson.error || "Không tạo được phiên upload Drive");
    }
    const uploaded = await putFileWithProgress(
      sessionJson.uploadUrl,
      f,
      setProgress,
    );
    const fileId = uploaded.id;
    if (!fileId) throw new Error("Google Drive không trả về fileId");
    const completeRes = await fetch("/api/uploads/drive/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileId }),
    });
    const completeJson = await completeRes.json();
    if (!completeRes.ok) {
      throw new Error(completeJson.error || "Không hoàn tất upload Drive");
    }
    return completeJson.drive as DriveMeta;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (duplicate) {
      setError("Video này đã tồn tại trong hệ thống.");
      return;
    }
    if (!isDrive && !videoUrl.trim()) {
      setError("Vui lòng nhập link video gốc.");
      return;
    }
    if (isDrive && !file) {
      setError("Vui lòng chọn file video để upload.");
      return;
    }
    setSubmitting(true);
    try {
      let drive: DriveMeta | null = null;
      if (file) drive = await uploadToDrive(file);

      const res = await fetch("/api/video-intake/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopee_product_url: shopeeUrl,
          product_price: price,
          commission_percent: percent,
          category_id: categoryId || null,
          source_type: sourceType,
          original_video_url: isDrive ? null : videoUrl,
          staff_note: note || null,
          drive,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Lưu video thất bại");
      }
      router.push(redirectTo);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra");
      setSubmitting(false);
      setProgress(null);
    }
  }

  const disabled = submitting || duplicate || checking;

  return (
    <form onSubmit={onSubmit} className="max-w-2xl space-y-5">
      <fieldset className="space-y-4 rounded-xl border border-gray-200 bg-white p-4">
        <legend className="px-1 text-sm font-semibold text-gray-700">
          Thông tin sản phẩm
        </legend>
        <Field label="Link sản phẩm Shopee" required>
          <input
            type="url"
            required
            value={shopeeUrl}
            onChange={(e) => setShopeeUrl(e.target.value)}
            placeholder="https://shopee.vn/..."
            className={inputClass}
          />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Giá sản phẩm (₫)" required>
            <input
              type="number"
              min="0"
              step="1"
              required
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="% hoa hồng" required>
            <input
              type="number"
              min="0"
              step="0.01"
              required
              value={percent}
              onChange={(e) => setPercent(e.target.value)}
              className={inputClass}
            />
          </Field>
        </div>
        <div className="rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-800">
          Hoa hồng dự kiến:{" "}
          <span className="font-semibold">{formatCurrency(estimated)}</span>
        </div>
        <Field label="Danh mục sản phẩm">
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className={inputClass}
          >
            <option value="">— Chọn danh mục —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
      </fieldset>

      <fieldset className="space-y-4 rounded-xl border border-gray-200 bg-white p-4">
        <legend className="px-1 text-sm font-semibold text-gray-700">
          Thông tin video
        </legend>
        <Field label="Nguồn video" required>
          <select
            value={sourceType}
            onChange={(e) => {
              setSourceTouched(true);
              setSourceType(e.target.value as VideoSourceType);
            }}
            className={inputClass}
          >
            {SOURCE_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {SOURCE_TYPE_LABELS[s]}
              </option>
            ))}
          </select>
        </Field>

        {!isDrive && (
          <Field label="Link video gốc" required>
            <input
              type="url"
              required={!isDrive}
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="Link TikTok / Facebook / YouTube / khác"
              className={inputClass}
            />
            <div className="mt-1 flex items-center gap-2 text-xs">
              {videoUrl.trim() && (
                <span className="text-gray-500">
                  Nguồn nhận diện:{" "}
                  <span className="font-medium text-gray-700">
                    {SOURCE_TYPE_LABELS[detectVideoSource(videoUrl)]}
                  </span>
                </span>
              )}
              {checking && <span className="text-gray-400">Đang kiểm tra…</span>}
            </div>
            {duplicate && dupMsg && (
              <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                ⚠️ {dupMsg}
              </p>
            )}
          </Field>
        )}

        <Field
          label={
            isDrive
              ? "Upload file video lên Google Drive (bắt buộc)"
              : "Upload file video lên Google Drive (tuỳ chọn — giúp chấm chính xác hơn)"
          }
        >
          <input
            type="file"
            accept="video/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-brand-dark"
          />
          {file && (
            <p className="mt-1 text-xs text-gray-500">
              {file.name} ({(file.size / 1024 / 1024).toFixed(1)} MB)
            </p>
          )}
          {progress !== null && (
            <div className="mt-2">
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                <div
                  className="h-full bg-brand transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Đang upload {progress}%
              </p>
            </div>
          )}
        </Field>

        <Field label="Ghi chú nhân viên (tuỳ chọn)">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className={inputClass}
          />
        </Field>
      </fieldset>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={disabled}
        className="rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? "Đang lưu…" : "Gửi video"}
      </button>
    </form>
  );
}

const inputClass =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand";

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      {children}
    </div>
  );
}
