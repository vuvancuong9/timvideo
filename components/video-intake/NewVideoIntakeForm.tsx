"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { detectVideoSource } from "@/lib/video-intake/normalize-url";
import { SOURCE_TYPE_LABELS } from "@/lib/video-intake/labels";
import { formatCurrency } from "@/lib/format";
import {
  PreviewResultPanel,
  type PreviewData,
} from "@/components/video-review/PreviewResultPanel";
import { SearchableSelect } from "@/components/SearchableSelect";
import type { PolicyRiskGroup } from "@/lib/video-review/policy-groups-config";
import type {
  VideoSourceType,
  SubmissionAttachment,
} from "@/types/videoIntake";

type Category = { id: string; name: string };

/** Metadata 1 file đã upload. */
type UploadedFile = {
  publicUrl: string;
  name: string;
  mimeType: string;
  kind: "video" | "image";
};

/** File đã PUT lên Drive nhưng chưa cấp quyền xem theo link. */
type DriveUpload = {
  fileId: string;
  name: string;
  mimeType: string;
  kind: "video" | "image";
};

type FileUploadStatus =
  | { state: "uploading"; pct: number }
  | { state: "done" }
  | { state: "error"; message: string };

function fileKey(f: File): string {
  return `${f.name}|${f.size}|${f.lastModified}|${f.type}`;
}

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
  const [error, setError] = useState<string | null>(null);

  const [scoring, setScoring] = useState(false);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [riskGroups, setRiskGroups] = useState<PolicyRiskGroup[]>([]);
  const [subId, setSubId] = useState<string>("");

  const categoryOptions = useMemo(
    () => categories.map((c) => ({ value: c.id, label: c.name })),
    [categories],
  );

  // Bắt buộc chấm điểm xong mới cho gửi. Khi đổi thông tin ảnh hưởng điểm thì
  // preview cũ không còn đúng -> xóa, buộc chấm lại.
  function invalidatePreview() {
    setPreview((p) => (p ? null : p));
  }

  // File được tải lên NGAY khi chọn (chạy ngầm trong lúc nhân viên điền tiếp
  // form); chấm thử / gửi chỉ chờ đúng lượt tải đó, không tải lại. File tải
  // ngầm vẫn RIÊNG TƯ trên Drive, chỉ cấp quyền xem theo link khi bấm Chấm /
  // Gửi (bỏ form giữa chừng thì không để lại file công khai). Khoá theo nội
  // dung file vì chọn lại cùng file thì trình duyệt tạo đối tượng File mới.
  const uploadCache = useRef<Map<string, Promise<DriveUpload>>>(new Map());
  const publishCache = useRef<Map<string, Promise<UploadedFile>>>(new Map());
  const uploadAborts = useRef<Map<string, AbortController>>(new Map());
  // key -> fileId của file đã lên Drive; còn trong map mà chưa publish = file
  // riêng tư cần dọn nếu nhân viên bỏ không gửi.
  const uploadedIds = useRef<Map<string, string>>(new Map());
  const [fileStatus, setFileStatus] = useState<Map<string, FileUploadStatus>>(
    () => new Map(),
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  /** Bỏ (vào thùng rác) file đã tải nhưng chưa từng chấm/gửi. */
  function discardIfUnpublished(key: string, viaBeacon = false) {
    const fileId = uploadedIds.current.get(key);
    if (!fileId || publishCache.current.has(key)) return;
    uploadedIds.current.delete(key);
    discardFileId(fileId, viaBeacon);
  }

  function discardFileId(fileId: string, viaBeacon = false) {
    const body = JSON.stringify({ fileId });
    if (viaBeacon && typeof navigator !== "undefined" && navigator.sendBeacon) {
      navigator.sendBeacon(
        "/api/uploads/file/discard",
        new Blob([body], { type: "application/json" }),
      );
      return;
    }
    fetch("/api/uploads/file/discard", {
      method: "POST",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body,
    }).catch(() => {});
  }

  function setStatus(key: string, s: FileUploadStatus | null) {
    setFileStatus((prev) => {
      const next = new Map(prev);
      if (s) next.set(key, s);
      else next.delete(key);
      return next;
    });
  }

  /** Huỷ lượt tải đang chạy của file (nếu có) và quên kết quả. */
  function cancelUpload(f: File) {
    const key = fileKey(f);
    uploadAborts.current.get(key)?.abort();
    uploadAborts.current.delete(key);
    discardIfUnpublished(key);
    uploadCache.current.delete(key);
    publishCache.current.delete(key);
    setStatus(key, null);
  }

  // Rời trang / đóng tab: huỷ lượt tải dở, dọn file đã tải mà không gửi.
  // (Gửi xong thì mọi file đã publish nên không bị dọn.)
  useEffect(() => {
    const aborts = uploadAborts.current;
    const ids = uploadedIds.current;
    const leave = () => {
      for (const c of aborts.values()) c.abort();
      for (const key of [...ids.keys()]) discardIfUnpublished(key, true);
    };
    window.addEventListener("pagehide", leave);
    return () => {
      window.removeEventListener("pagehide", leave);
      leave();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startAll(list: File[]) {
    list.forEach((f, i) => {
      startUpload(f, i + 1).catch(() => {
        // lỗi hiện ở danh sách file; bấm Gửi sẽ tải lại
      });
    });
  }

  // Link bị báo trùng → không gửi được → dừng tải cho đỡ tốn Drive; đổi sang
  // link hợp lệ thì tải tiếp.
  useEffect(() => {
    if (duplicate) {
      for (const f of files) {
        if (fileStatus.get(fileKey(f))?.state === "uploading") cancelUpload(f);
      }
    } else if (!checking) {
      startAll(files);
    }
    // chỉ phản ứng khi kết quả kiểm tra trùng đổi
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duplicate, checking]);

  /** Chọn file mới: huỷ file bị bỏ, bắt đầu tải ngay các file mới. */
  function selectFiles(next: File[]) {
    const keep = new Set(next.map(fileKey));
    for (const f of files) if (!keep.has(fileKey(f))) cancelUpload(f);
    setFiles(next);
    invalidatePreview();
    if (!duplicate && !checking) startAll(next);
  }

  /** Xóa 1 file đã chọn (video/ảnh): huỷ upload + buộc chấm điểm lại. */
  function removeFile(i: number) {
    invalidatePreview();
    const target = files[i];
    if (target) cancelUpload(target);
    const next = files.filter((_, idx) => idx !== i);
    setFiles(next);
    // Hết file -> reset input để chọn lại đúng file đó vẫn nhận, và bỏ tên cũ.
    if (next.length === 0 && fileInputRef.current) {
      fileInputRef.current.value = "";
    }
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
          if (json.from_seed) {
            setDupMsg("Video này đã làm trước đó (có trong danh sách cũ).");
          } else {
            const by = json.existing?.created_by_name
              ? ` (người nhập: ${json.existing.created_by_name})`
              : "";
            setDupMsg(`Video này đã có người nhập rồi${by}.`);
          }
        }
      } catch {
        // server vẫn chặn khi submit
      } finally {
        setChecking(false);
      }
    }, 500);
    return () => clearTimeout(t);
  }, [videoUrl]);

  /** PUT file lên resumable URL của Drive, trả fileId. onProgress: % đã tải. */
  function putToDrive(
    url: string,
    f: File,
    onProgress?: (pct: number) => void,
    signal?: AbortSignal,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      if (signal) {
        if (signal.aborted) return reject(new Error("Đã huỷ tải lên"));
        signal.addEventListener("abort", () => xhr.abort(), { once: true });
      }
      xhr.onabort = () => reject(new Error("Đã huỷ tải lên"));
      xhr.open("PUT", url, true);
      xhr.setRequestHeader(
        "Content-Type",
        f.type || "application/octet-stream",
      );
      if (onProgress) {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            onProgress(Math.round((e.loaded / e.total) * 100));
          }
        };
      }
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
   * Upload 1 file (dùng chung kết quả nếu file này đang/đã được tải). Lỗi thì
   * quên kết quả để lần sau tải lại.
   */
  function startUpload(f: File, index: number): Promise<DriveUpload> {
    const key = fileKey(f);
    const cached = uploadCache.current.get(key);
    if (cached) return cached;
    const ctrl = new AbortController();
    uploadAborts.current.set(key, ctrl);
    setStatus(key, { state: "uploading", pct: 0 });
    const p: Promise<DriveUpload> = uploadOne(
      f,
      index,
      (pct) => {
        if (!ctrl.signal.aborted) setStatus(key, { state: "uploading", pct });
      },
      ctrl.signal,
    )
      .then((up) => {
        if (ctrl.signal.aborted) {
          // Bị huỷ đúng lúc vừa tải xong: file đã nằm trên Drive → dọn luôn.
          discardFileId(up.fileId);
          throw new Error("Đã huỷ tải lên");
        }
        uploadedIds.current.set(key, up.fileId);
        setStatus(key, { state: "done" });
        return up;
      })
      .catch((err: unknown) => {
        if (uploadCache.current.get(key) === p) uploadCache.current.delete(key);
        if (!ctrl.signal.aborted) {
          setStatus(key, {
            state: "error",
            message: err instanceof Error ? err.message : "Tải lên thất bại",
          });
        }
        throw err;
      })
      .finally(() => {
        if (uploadAborts.current.get(key) === ctrl) uploadAborts.current.delete(key);
      });
    uploadCache.current.set(key, p);
    return p;
  }

  /** Cấp quyền xem theo link cho file đã tải (1 lần mỗi file) → link dùng cho AI / Sheet. */
  function publishUpload(f: File, up: DriveUpload): Promise<UploadedFile> {
    const key = fileKey(f);
    const cached = publishCache.current.get(key);
    if (cached) return cached;
    const p = (async (): Promise<UploadedFile> => {
      const compRes = await fetch("/api/uploads/file/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId: up.fileId }),
      });
      const compJson = await compRes.json();
      if (!compRes.ok) {
        throw new Error(compJson.error || "Không hoàn tất upload Drive");
      }
      return {
        publicUrl: compJson.drive.webViewLink || compJson.drive.directUrl || "",
        name: up.name,
        mimeType: up.mimeType,
        kind: up.kind,
      };
    })();
    publishCache.current.set(key, p);
    p.catch(() => {
      if (publishCache.current.get(key) === p) publishCache.current.delete(key);
    });
    return p;
  }

  /**
   * Upload 1 file lên Google Drive: tạo phiên → PUT thẳng từ trình duyệt.
   * File còn riêng tư cho tới khi publishUpload.
   */
  async function uploadOne(
    f: File,
    index: number,
    onProgress: (pct: number) => void,
    signal: AbortSignal,
  ): Promise<DriveUpload> {
    const sessionRes = await fetch("/api/uploads/file/create-session", {
      method: "POST",
      signal,
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

    if (sessionJson.mode !== "drive" || !sessionJson.uploadUrl) {
      throw new Error("Server không trả phiên upload Google Drive");
    }
    const fileId = await putToDrive(sessionJson.uploadUrl, f, onProgress, signal);
    return {
      fileId,
      name: f.name,
      mimeType: f.type || "application/octet-stream",
      kind: isImageFile(f) ? "image" : "video",
    };
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
    const uploads: DriveUpload[] = [];
    for (const [i, f] of files.entries()) uploads.push(await startUpload(f, i + 1));
    const metas = await Promise.all(files.map((f, i) => publishUpload(f, uploads[i])));

    const attachments: SubmissionAttachment[] = [];
    let primaryVideo: UploadedFile | null = null;
    for (const meta of metas) {
      attachments.push({
        drive_file_id: "",
        name: meta.name,
        web_url: meta.publicUrl,
        mime_type: meta.mimeType,
        kind: meta.kind,
      });
      if (meta.kind === "video" && !primaryVideo) primaryVideo = meta;
    }
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
    // BẮT BUỘC khi gửi: giá (trên 1.000đ), % hoa hồng, danh mục.
    if (!price.trim()) {
      setError("Vui lòng nhập giá sản phẩm.");
      return;
    }
    const priceNum = Number(price);
    if (!Number.isFinite(priceNum) || priceNum <= 1000) {
      setError("Giá sản phẩm phải trên 1.000đ.");
      return;
    }
    if (!percent.trim() || !Number.isFinite(Number(percent))) {
      setError("Vui lòng nhập % hoa hồng.");
      return;
    }
    if (!categoryId) {
      setError("Vui lòng chọn danh mục sản phẩm.");
      return;
    }
    // BẮT BUỘC: gửi phải có CẢ link video gốc VÀ file video tải lên.
    if (!hasLink || !hasVideoFile) {
      setError(
        "Phải có CẢ link video gốc VÀ file video tải lên mới gửi được video.",
      );
      return;
    }
    // Chấm điểm thử là TUỲ CHỌN — không bắt buộc trước khi gửi.
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
          // Nếu ĐÃ chấm thử thì gửi kèm điểm để ghi Sheet ngay; không thì để
          // null, worker nền sẽ tự chấm sau (không bắt buộc chấm trước khi gửi).
          preview_scores: preview
            ? {
                creative_score: preview.creative.creative_score,
                policy_safety_score: preview.policy.policy_safety_score,
                copyright_safety_score: preview.policy.copyright_safety_score,
                final_score: preview.decision.final_score,
                final_action: preview.decision.final_action,
              }
            : null,
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
    }
  }

  const busy = submitting || scoring;
  const uploadingIdx = files.findIndex(
    (f) => fileStatus.get(fileKey(f))?.state === "uploading",
  );
  const uploadingStatus =
    uploadingIdx >= 0 ? fileStatus.get(fileKey(files[uploadingIdx])) : undefined;
  const activeUpload =
    uploadingStatus?.state === "uploading"
      ? {
          label: `Đang tải lên ${uploadingIdx + 1}/${files.length}: ${files[uploadingIdx].name}`,
          pct: Math.min(uploadingStatus.pct, 100),
        }
      : null;
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
        <Field label="Danh mục sản phẩm" required>
          <SearchableSelect
            value={categoryId}
            onChange={setCategoryId}
            options={categoryOptions}
            placeholder="— Chọn danh mục —"
            emptyText="Không tìm thấy danh mục"
          />
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
            Để GỬI cần CẢ link video gốc + file video. Nút trên chọn nguồn để AI
            chấm.{" "}
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
            disabled={busy}
            onChange={(e) => selectFiles(Array.from(e.target.files ?? []))}
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
                  <UploadBadge status={fileStatus.get(fileKey(f))} />
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
                selectFiles([]);
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

      {activeUpload && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="truncate text-sm font-medium text-blue-900">
              {activeUpload.label}
            </span>
            <span className="shrink-0 text-lg font-bold tabular-nums text-brand">
              {activeUpload.pct >= 100 ? "Đang hoàn tất…" : `${activeUpload.pct}%`}
            </span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-blue-100">
            <div
              className="h-full rounded-full bg-brand transition-all duration-200"
              style={{ width: `${activeUpload.pct}%` }}
            />
          </div>
          {!busy && (
            <p className="mt-2 text-xs text-blue-800">
              Video đang tải lên trong lúc bạn điền tiếp — bấm “Gửi video” bất cứ
              lúc nào, phần còn lại sẽ tải nốt.
            </p>
          )}
        </div>
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
          disabled={submitDisabled || !hasLink || !hasVideoFile}
          className="rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
          title={
            !hasLink || !hasVideoFile
              ? "Cần cả link video gốc và file video mới gửi được"
              : undefined
          }
        >
          {submitting ? "Đang lưu…" : "Gửi video"}
        </button>
        <span className="text-xs text-gray-400">
          {!hasLink || !hasVideoFile
            ? "Cần CẢ link video gốc + file video tải lên mới gửi được (chấm điểm thử là tuỳ chọn)."
            : "Đủ link + file — có thể gửi (worker sẽ tự chấm), hoặc bấm “Chấm điểm thử ngay” để xem trước."}
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

function UploadBadge({ status }: { status?: FileUploadStatus }) {
  if (!status) return null;
  if (status.state === "uploading") {
    return <span className="shrink-0 tabular-nums text-blue-600">{status.pct}%</span>;
  }
  if (status.state === "done") {
    return <span className="shrink-0 font-medium text-green-600">✓ Đã tải lên</span>;
  }
  return (
    <span className="shrink-0 text-red-600" title={status.message}>
      Lỗi tải — sẽ thử lại khi Gửi
    </span>
  );
}

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
