"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { detectVideoSource } from "@/lib/video-intake/normalize-url";
import { SOURCE_TYPE_LABELS } from "@/lib/video-intake/labels";
import { formatCurrency } from "@/lib/format";
import {
  PreviewResultPanel,
  type PreviewData,
} from "@/components/video-review/PreviewResultPanel";
import type { PolicyRiskGroup } from "@/lib/video-review/policy-groups-config";
import type {
  VideoSourceType,
  SubmissionAttachment,
} from "@/types/videoIntake";

type Category = { id: string; name: string };

/** Metadata 1 file đã upload lên Supabase Storage. */
type UploadedFile = {
  publicUrl: string;
  name: string;
  mimeType: string;
  kind: "video" | "image";
};

const SOURCE_OPTIONS: VideoSourceType[] = [
  "tiktok_url",
  "facebook_url",
  "youtube_url",
  "drive_upload",
  "other_url",
];

function isImageFile(f: File): boolean {
  return f.type.startsWith("image/");
}
function isVideoFile(f: File): boolean {
  return f.type.startsWith("video/");
}

export function NewVideoIntakeForm({
  categories,
  redirectTo = "/staff/my-videos",
}: {
  categories: Category[];
  redirectTo?: string;
}) {
  const router = useRouter();

  const [productName, setProductName] = useState("");
  const [shopeeUrl, setShopeeUrl] = useState("");
  const [price, setPrice] = useState("");
  const [percent, setPercent] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [sourceType, setSourceType] = useState<VideoSourceType>("tiktok_url");
  const [sourceTouched, setSourceTouched] = useState(false);
  // Chấm theo file video tải lên hay theo link video (chọn 1, ẩn cái kia).
  const [inputMode, setInputMode] = useState<"file" | "link">("file");
  const [note, setNote] = useState("");
  const [files, setFiles] = useState<File[]>([]);

  const [checking, setChecking] = useState(false);
  const [duplicate, setDuplicate] = useState(false);
  const [dupMsg, setDupMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadInfo, setUploadInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [scoring, setScoring] = useState(false);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [riskGroups, setRiskGroups] = useState<PolicyRiskGroup[]>([]);
  const [subId, setSubId] = useState<string>("");

  // Bắt buộc chấm điểm xong mới cho gửi. Khi đổi thông tin ảnh hưởng điểm thì
  // preview cũ không còn đúng -> xóa, buộc chấm lại.
  function invalidatePreview() {
    setPreview((p) => (p ? null : p));
  }

  // Cache file -> đã upload, để chấm thử rồi gửi không upload lại.
  const uploadCache = useRef<Map<File, UploadedFile>>(new Map());
  const fileInputRef = useRef<HTMLInputElement>(null);

  /** Xóa 1 file đã chọn (video/ảnh): bỏ cache upload + buộc chấm điểm lại. */
  function removeFile(i: number) {
    invalidatePreview();
    setFiles((prev) => {
      const target = prev[i];
      if (target) uploadCache.current.delete(target);
      const next = prev.filter((_, idx) => idx !== i);
      // Hết file -> reset input để chọn lại đúng file đó vẫn nhận, và bỏ tên cũ.
      if (next.length === 0 && fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return next;
    });
  }

  /** Đổi nguồn chấm điểm (file/link). Cả 2 ô vẫn điền được; chỉ buộc chấm lại. */
  function chooseMode(m: "file" | "link") {
    if (m === inputMode) return;
    setInputMode(m);
    invalidatePreview();
  }

  // Lấy Sub ID dự kiến cho nhân viên hiện tại (ngày + account + STT).
  useEffect(() => {
    let alive = true;
    fetch("/api/video-intake/next-sub-id")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (alive && j?.subId) setSubId(j.subId);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const hasLink = videoUrl.trim().length > 0;
  const hasVideoFile = files.some(isVideoFile);
  const imageCount = files.filter(isImageFile).length;

  useEffect(() => {
    if (sourceTouched) return;
    if (videoUrl.trim()) setSourceType(detectVideoSource(videoUrl));
  }, [videoUrl, sourceTouched]);

  const effectiveSource: VideoSourceType =
    inputMode === "file" ? "drive_upload" : sourceType;

  const estimated = useMemo(() => {
    const p = Number(price);
    const c = Number(percent);
    if (!Number.isFinite(p) || !Number.isFinite(c)) return 0;
    return (p * c) / 100;
  }, [price, percent]);

  const lastChecked = useRef("");

  useEffect(() => {
    const url = videoUrl.trim();
    setDuplicate(false);
    setDupMsg(null);
    if (!url) {
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
        // server vẫn chặn khi submit
      } finally {
        setChecking(false);
      }
    }, 500);
    return () => clearTimeout(t);
  }, [videoUrl]);

  /** PUT file lên resumable URL của Drive, trả fileId. */
  function putToDrive(url: string, f: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", url, true);
      xhr.setRequestHeader(
        "Content-Type",
        f.type || "application/octet-stream",
      );
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText).id);
          } catch {
            reject(new Error("Drive không trả fileId"));
          }
        } else {
          reject(new Error(`Upload Drive thất bại (${xhr.status})`));
        }
      };
      xhr.onerror = () => reject(new Error("Lỗi mạng khi upload Drive"));
      xhr.send(f);
    });
  }

  /**
   * Upload 1 file. Tự chọn nơi lưu: Google Drive (nếu admin đã kết nối) hoặc
   * Supabase Storage (fallback). Đặt tên theo Sub ID.
   */
  async function uploadOne(f: File, index: number): Promise<UploadedFile> {
    const cached = uploadCache.current.get(f);
    if (cached) return cached;

    const sessionRes = await fetch("/api/uploads/file/create-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: f.name,
        mimeType: f.type || "application/octet-stream",
        fileSize: f.size,
        baseName: subId || null,
        index,
      }),
    });
    const sessionJson = await sessionRes.json();
    if (!sessionRes.ok) {
      throw new Error(
        [sessionJson.error, sessionJson.detail].filter(Boolean).join(" — ") ||
          "Không tạo được phiên upload",
      );
    }

    let meta: UploadedFile;
    if (sessionJson.mode === "drive") {
      const fileId = await putToDrive(sessionJson.uploadUrl, f);
      const compRes = await fetch("/api/uploads/file/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId }),
      });
      const compJson = await compRes.json();
      if (!compRes.ok) {
        throw new Error(compJson.error || "Không hoàn tất upload Drive");
      }
      meta = {
        publicUrl: compJson.drive.webViewLink || compJson.drive.directUrl || "",
        name: f.name,
        mimeType: f.type || "application/octet-stream",
        kind: isImageFile(f) ? "image" : "video",
      };
    } else {
      // mode 'storage'
      const supabase = createSupabaseBrowserClient();
      const { error: upErr } = await supabase.storage
        .from(sessionJson.bucket)
        .uploadToSignedUrl(sessionJson.path, sessionJson.token, f, {
          contentType: f.type || "application/octet-stream",
        });
      if (upErr) throw new Error(`Upload thất bại: ${upErr.message}`);
      meta = {
        publicUrl: sessionJson.publicUrl,
        name: f.name,
        mimeType: f.type || "application/octet-stream",
        kind: isImageFile(f) ? "image" : "video",
      };
    }
    uploadCache.current.set(f, meta);
    return meta;
  }

  /** Upload tất cả file → {primary video meta cho cột drive_*, danh sách attachments}. */
  async function uploadAll(): Promise<{
    primary: {
      driveFileId: null;
      driveFileName: string | null;
      driveWebUrl: string | null;
      driveFolderId: null;
    } | null;
    attachments: SubmissionAttachment[];
  }> {
    const attachments: SubmissionAttachment[] = [];
    let primaryVideo: UploadedFile | null = null;
    let done = 0;
    for (const f of files) {
      setUploadInfo(`Đang tải lên ${done + 1}/${files.length}: ${f.name}`);
      const meta = await uploadOne(f, done + 1);
      attachments.push({
        drive_file_id: "",
        name: meta.name,
        web_url: meta.publicUrl,
        mime_type: meta.mimeType,
        kind: meta.kind,
      });
      if (meta.kind === "video" && !primaryVideo) primaryVideo = meta;
      done += 1;
    }
    setUploadInfo(null);
    const primary = primaryVideo
      ? {
          driveFileId: null as null,
          driveFileName: primaryVideo.name,
          driveWebUrl: primaryVideo.publicUrl,
          driveFolderId: null as null,
        }
      : null;
    return { primary, attachments };
  }

  function validateInputs(): string | null {
    if (!productName.trim()) {
      return "Vui lòng nhập tên sản phẩm.";
    }
    if (inputMode === "file" && !hasVideoFile) {
      return "Hãy tải lên file video để chấm điểm (hoặc chuyển sang 'Link video').";
    }
    if (inputMode === "link" && !hasLink) {
      return "Hãy dán link video để chấm điểm (hoặc chuyển sang 'File video').";
    }
    return null;
  }

  async function onScore() {
    setError(null);
    setPreview(null);
    const v = validateInputs();
    if (v) {
      setError(v);
      return;
    }
    setScoring(true);
    try {
      let primary = null;
      let attachments: SubmissionAttachment[] = [];
      if (files.length) ({ primary, attachments } = await uploadAll());
      const res = await fetch("/api/video-review/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopee_product_url: shopeeUrl,
          product_price: price,
          commission_percent: percent,
          category_id: categoryId || null,
          source_type: effectiveSource,
          original_video_url: hasLink ? videoUrl : null,
          drive: primary,
          attachments,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(
          [json.error, json.detail].filter(Boolean).join(" — ") ||
            "Chấm điểm thất bại",
        );
      }
      setPreview(json.preview as PreviewData);
      setRiskGroups((json.riskGroups as PolicyRiskGroup[]) ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra");
    } finally {
      setScoring(false);
      setUploadInfo(null);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (duplicate) {
      setError("Video này đã tồn tại trong hệ thống.");
      return;
    }
    const v = validateInputs();
    if (v) {
      setError(v);
      return;
    }
    // BẮT BUỘC: phải chấm điểm thử xong mới cho gửi.
    if (!preview) {
      setError('Vui lòng bấm "🎯 Chấm điểm thử ngay" trước khi gửi video.');
      return;
    }
    setSubmitting(true);
    try {
      let primary = null;
      let attachments: SubmissionAttachment[] = [];
      if (files.length) ({ primary, attachments } = await uploadAll());

      const res = await fetch("/api/video-intake/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_name: productName.trim(),
          shopee_product_url: shopeeUrl,
          product_price: price,
          commission_percent: percent,
          category_id: categoryId || null,
          source_type: effectiveSource,
          original_video_url: hasLink ? videoUrl : null,
          staff_note: note || null,
          drive: primary,
          attachments,
          // Gửi kèm điểm đã chấm thử để lưu DB + ghi Sheet ngay (khỏi chờ worker).
          preview_scores: {
            creative_score: preview.creative.creative_score,
            policy_safety_score: preview.policy.policy_safety_score,
            copyright_safety_score: preview.policy.copyright_safety_score,
            final_score: preview.decision.final_score,
            final_action: preview.decision.final_action,
          },
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
      setUploadInfo(null);
    }
  }

  const busy = submitting || scoring;
  const submitDisabled = busy || duplicate || checking;

  return (
    <form onSubmit={onSubmit} className="max-w-2xl space-y-5">
      <fieldset className="space-y-4 rounded-xl border border-gray-200 bg-white p-4">
        <legend className="px-1 text-sm font-semibold text-gray-700">
          Thông tin sản phẩm
        </legend>
        <Field label="Sub ID (tự tạo)">
          <input
            type="text"
            value={subId || "Đang tạo…"}
            readOnly
            className={`${inputClass} bg-gray-50 font-mono text-gray-600`}
          />
          <p className="mt-1 text-xs text-gray-400">
            Mã tự sinh: ngày + tài khoản của bạn + số thứ tự. File tải lên sẽ
            được đặt tên theo mã này.
          </p>
        </Field>
        <Field label="Tên sản phẩm" required>
          <input
            type="text"
            required
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            placeholder="VD: Máy hút bụi cầm tay XYZ"
            className={inputClass}
          />
        </Field>
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

        <div>
          <p className="mb-2 text-xs font-medium text-gray-600">
            Chấm điểm dựa trên:
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => chooseMode("file")}
              className={`rounded-lg border px-4 py-2 text-sm font-medium ${
                inputMode === "file"
                  ? "border-brand bg-blue-50 text-brand"
                  : "border-gray-300 text-gray-600 hover:bg-gray-50"
              }`}
            >
              📹 File video tải lên
            </button>
            <button
              type="button"
              onClick={() => chooseMode("link")}
              className={`rounded-lg border px-4 py-2 text-sm font-medium ${
                inputMode === "link"
                  ? "border-brand bg-blue-50 text-brand"
                  : "border-gray-300 text-gray-600 hover:bg-gray-50"
              }`}
            >
              🔗 Link video
            </button>
          </div>
          <p className="mt-2 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">
            Điền link và/hoặc tải file đều được — nút trên chọn nguồn để AI chấm.{" "}
            {inputMode === "file"
              ? "Đang chấm theo FILE video tải lên (AI xem video thật, chính xác nhất)."
              : "Đang chấm theo LINK. YouTube: AI xem trực tiếp; TikTok/Facebook chỉ SƠ BỘ — muốn chính xác hãy chọn “File video tải lên”."}
          </p>
        </div>

        <Field label="Nguồn video">
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

        <Field label="Link video gốc (nếu có)">
          <input
            type="url"
            value={videoUrl}
            onChange={(e) => {
              setVideoUrl(e.target.value);
              invalidatePreview();
            }}
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

        <Field label="Tải lên file video (có thể kèm ảnh số liệu)">
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*,image/*"
            multiple
            onChange={(e) => {
              setFiles(Array.from(e.target.files ?? []));
              invalidatePreview();
            }}
            className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-brand-dark"
          />
          {files.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs text-gray-600">
              {files.map((f, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                      isImageFile(f)
                        ? "bg-purple-100 text-purple-700"
                        : "bg-blue-100 text-blue-700"
                    }`}
                  >
                    {isImageFile(f) ? "ẢNH" : "VIDEO"}
                  </span>
                  <span className="truncate">{f.name}</span>
                  <span className="shrink-0 text-gray-400">
                    ({(f.size / 1024 / 1024).toFixed(1)} MB)
                  </span>
                  <button
                    type="button"
                    onClick={() => removeFile(i)}
                    disabled={busy}
                    className="ml-auto shrink-0 rounded px-1.5 py-0.5 font-medium text-red-600 hover:bg-red-50 disabled:opacity-40"
                    aria-label={`Xóa ${f.name}`}
                    title="Xóa file này, chọn file khác"
                  >
                    ✕ Xóa
                  </button>
                </li>
              ))}
            </ul>
          )}
          {files.length > 0 && (
            <button
              type="button"
              onClick={() => {
                invalidatePreview();
                for (const f of files) uploadCache.current.delete(f);
                setFiles([]);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              disabled={busy}
              className="mt-2 text-xs font-medium text-red-600 hover:underline disabled:opacity-40"
            >
              Xóa tất cả & chọn lại
            </button>
          )}
          {imageCount > 0 && (
            <p className="mt-1 text-xs text-purple-600">
              {imageCount} ảnh sẽ được AI đọc (vd số liệu like/view/comment).
            </p>
          )}
          {uploadInfo && (
            <p className="mt-1 text-xs text-gray-500">{uploadInfo}</p>
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

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onScore}
          disabled={busy || duplicate}
          className="rounded-lg border border-brand px-5 py-2.5 text-sm font-semibold text-brand transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {scoring
            ? "Đang chấm điểm…"
            : preview
              ? "🎯 Chấm lại"
              : "🎯 Chấm điểm thử ngay"}
        </button>
        <button
          type="submit"
          disabled={submitDisabled || !preview}
          className="rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
          title={!preview ? "Hãy chấm điểm thử trước khi gửi" : undefined}
        >
          {submitting ? "Đang lưu…" : "Gửi video"}
        </button>
        <span className="text-xs text-gray-400">
          {preview
            ? "Đã chấm điểm — bạn có thể gửi video."
            : "Bắt buộc bấm “Chấm điểm thử ngay” trước, rồi mới gửi được."}
        </span>
      </div>

      {preview && (
        <PreviewResultPanel data={preview} riskGroups={riskGroups} />
      )}
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
