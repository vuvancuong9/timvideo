/**
 * Chuẩn bị INPUT VIDEO THẬT cho Gemini. Server-only.
 *
 * - YouTube public → file_data{file_uri} (Gemini tự đọc, không tải).
 * - File trên Storage/Drive public → fetch về: nhỏ → inline_data base64;
 *   lớn → Files API (resumable upload + poll ACTIVE) → file_data{file_uri}.
 * - TikTok/Facebook bare link (không có file) → KHÔNG gửi (Gemini không đọc được).
 *
 * Nguyên tắc: phần "đã gửi part gì" do CODE biết (videoSeenSent) — đây là nguồn
 * sự thật cho evidence_level, model không thể tự nâng. Mọi lỗi tải/giờ giấc →
 * trả part=null + warning, KHÔNG ném (không làm fail cả job), KHÔNG bịa.
 */
import {
  canonicalizeVideoUrl,
  detectVideoSource,
} from "@/lib/video-intake/normalize-url";
import type { SubmissionAttachment } from "@/types/videoIntake";
import type { EvidenceLevel } from "@/types/videoReview";

export type VideoPart =
  | { file_data: { file_uri: string; mime_type?: string } }
  | { inline_data: { mime_type: string; data: string } };

export type ResolvedVideoInput = {
  part: VideoPart | null;
  videoSeenSent: boolean; // code-authoritative: đã gắn bytes/uri video chưa
  source: "youtube" | "storage_inline" | "files_api" | "none";
  warning?: string;
};

const GEMINI_BASE = "https://generativelanguage.googleapis.com";
const INLINE_MAX_RAW = 13 * 1024 * 1024; // 13MB → base64 ~17MB < giới hạn request 20MB
const MAX_FETCH_BYTES = 100 * 1024 * 1024; // chặn OOM serverless
const GENERATE_RESERVE_MS = 20_000; // chừa thời gian cho lần gọi generateContent

const EVIDENCE_RANK: Record<EvidenceLevel, number> = {
  text_only: 0,
  images_only: 1,
  frames: 2,
  video: 3,
};

/** Lấy mức bằng chứng THẤP hơn giữa code (đã gửi gì) và model (tự khai). */
export function reconcileEvidence(
  codeMax: EvidenceLevel,
  modelClaim: EvidenceLevel,
): EvidenceLevel {
  return EVIDENCE_RANK[codeMax] <= EVIDENCE_RANK[modelClaim]
    ? codeMax
    : modelClaim;
}

export function coerceEvidenceLevel(v: unknown): EvidenceLevel {
  const s = String(v ?? "").toLowerCase();
  if (s === "video" || s === "frames" || s === "images_only" || s === "text_only") {
    return s;
  }
  return "text_only";
}

export type VideoSourceClass =
  | { kind: "youtube"; url: string }
  | { kind: "fetch"; url: string; mimeHint: string | null }
  | { kind: "none"; warning: string };

/**
 * Quyết định NGUỒN video (chưa fetch) — PURE, để unit-test. Chỉ "fetch" với
 * file Storage/Drive của chính mình; link ngoài không phải YouTube → none.
 */
export function classifyVideoSource(args: {
  sourceType: string;
  originalVideoUrl: string | null;
  driveWebUrl: string | null;
  attachments: SubmissionAttachment[];
}): VideoSourceClass {
  const { sourceType, originalVideoUrl, driveWebUrl, attachments } = args;

  // 1) YouTube public → Gemini đọc trực tiếp.
  const isYouTube =
    sourceType === "youtube_url" ||
    (!!originalVideoUrl && detectVideoSource(originalVideoUrl) === "youtube_url");
  if (isYouTube && originalVideoUrl) {
    return { kind: "youtube", url: canonicalizeVideoUrl(originalVideoUrl) };
  }

  // 2) Video chính đã upload Storage.
  if (driveWebUrl) {
    return { kind: "fetch", url: driveWebUrl, mimeHint: null };
  }

  // 3) Attachment kind=video đầu tiên.
  const vid = (attachments ?? []).find(
    (a) => a && a.kind === "video" && a.web_url,
  );
  if (vid && vid.web_url) {
    return { kind: "fetch", url: vid.web_url, mimeHint: vid.mime_type ?? null };
  }

  // 4) Link ngoài không tải được.
  if (sourceType === "tiktok_url" || sourceType === "facebook_url") {
    return {
      kind: "none",
      warning:
        "Link TikTok/Facebook không tải trực tiếp được vào Gemini — cần upload file video để chấm chính xác.",
    };
  }
  return { kind: "none", warning: "Không có nguồn video đọc được để gửi Gemini." };
}

function guessMime(url: string, hint: string | null, header: string | null): string {
  if (hint && hint.startsWith("video/")) return hint;
  if (header && header.startsWith("video/")) return header;
  const lower = url.toLowerCase();
  if (lower.endsWith(".mov")) return "video/quicktime";
  if (lower.endsWith(".webm")) return "video/webm";
  if (lower.endsWith(".m4v")) return "video/x-m4v";
  return "video/mp4";
}

type FetchedVideo =
  | { ok: true; bytes: ArrayBuffer; mime: string }
  | { ok: false; warning: string };

/** Tải video với chặn kích thước (kiểm Content-Length trước khi buffer). */
async function fetchVideoBytesBounded(
  url: string,
  mimeHint: string | null,
): Promise<FetchedVideo> {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      return { ok: false, warning: `Không tải được video (HTTP ${res.status}).` };
    }
    const len = Number(res.headers.get("content-length") ?? "0");
    if (len && len > MAX_FETCH_BYTES) {
      return {
        ok: false,
        warning: `Video quá lớn (${Math.round(len / 1024 / 1024)}MB > ${MAX_FETCH_BYTES / 1024 / 1024}MB) — bỏ qua phân tích trực tiếp.`,
      };
    }
    const ab = await res.arrayBuffer();
    if (ab.byteLength > MAX_FETCH_BYTES) {
      return { ok: false, warning: "Video quá lớn — bỏ qua phân tích trực tiếp." };
    }
    return {
      ok: true,
      bytes: ab,
      mime: guessMime(url, mimeHint, res.headers.get("content-type")),
    };
  } catch (e) {
    return { ok: false, warning: `Lỗi tải video: ${String(e).slice(0, 120)}` };
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Upload bytes qua Files API (resumable) + poll tới ACTIVE. Trả file_uri hoặc null. */
async function uploadToFilesApi(
  bytes: ArrayBuffer,
  mime: string,
  apiKey: string,
  deadlineAt: number,
): Promise<{ uri: string; mime: string } | { error: string }> {
  // 1) start
  const startRes = await fetch(`${GEMINI_BASE}/upload/v1beta/files`, {
    method: "POST",
    headers: {
      "x-goog-api-key": apiKey,
      "X-Goog-Upload-Protocol": "resumable",
      "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Length": String(bytes.byteLength),
      "X-Goog-Upload-Header-Content-Type": mime,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ file: { display_name: "timvideo-review" } }),
  });
  const uploadUrl = startRes.headers.get("x-goog-upload-url");
  if (!startRes.ok || !uploadUrl) {
    return { error: `Files API start lỗi (HTTP ${startRes.status}).` };
  }

  // 2) upload + finalize
  const upRes = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Content-Length": String(bytes.byteLength),
      "X-Goog-Upload-Offset": "0",
      "X-Goog-Upload-Command": "upload, finalize",
    },
    body: new Blob([bytes]),
  });
  if (!upRes.ok) return { error: `Files API upload lỗi (HTTP ${upRes.status}).` };
  const upJson = (await upRes.json().catch(() => ({}))) as {
    file?: { name?: string; uri?: string; state?: string };
  };
  let file = upJson.file;
  if (!file?.uri || !file?.name) return { error: "Files API không trả file uri." };

  // 3) poll tới ACTIVE (tôn trọng deadline; chừa thời gian generateContent)
  const pollDeadline = deadlineAt - GENERATE_RESERVE_MS;
  let delay = 1000;
  while (file.state !== "ACTIVE") {
    if (file.state === "FAILED") return { error: "Gemini xử lý video thất bại." };
    if (Date.now() + delay > pollDeadline) {
      return { error: "Video xử lý quá lâu, vượt thời gian cho phép." };
    }
    await sleep(delay);
    delay = Math.min(delay + 500, 3000);
    const pollRes = await fetch(
      `${GEMINI_BASE}/v1beta/${file.name}?key=${encodeURIComponent(apiKey)}`,
    );
    if (!pollRes.ok) return { error: `Files API poll lỗi (HTTP ${pollRes.status}).` };
    file = ((await pollRes.json().catch(() => ({}))) as { state?: string; uri?: string; name?: string });
    if (!file.name) file.name = upJson.file!.name;
    if (!file.uri) file.uri = upJson.file!.uri;
  }
  return { uri: file.uri!, mime };
}

/**
 * Tạo VideoPart thật cho Gemini từ submission. KHÔNG ném — lỗi → part:null + warning.
 * @param deadlineAt epoch ms hạn chót của cả pipeline (để Files API không vượt giờ).
 * @param allowFilesApi false ở preview (đồng bộ, ngân sách hẹp) → chỉ inline/YouTube.
 * @param inlineDisallowed true khi có ảnh inline (chia sẻ giới hạn 20MB) → ép Files API.
 */
export async function resolveVideoInput(args: {
  sourceType: string;
  originalVideoUrl: string | null;
  driveWebUrl: string | null;
  attachments: SubmissionAttachment[];
  apiKey: string;
  deadlineAt: number;
  allowFilesApi: boolean;
  inlineDisallowed: boolean;
}): Promise<ResolvedVideoInput> {
  const cls = classifyVideoSource(args);

  if (cls.kind === "youtube") {
    return {
      part: { file_data: { file_uri: cls.url } },
      videoSeenSent: true,
      source: "youtube",
    };
  }
  if (cls.kind === "none") {
    return { part: null, videoSeenSent: false, source: "none", warning: cls.warning };
  }

  const fetched = await fetchVideoBytesBounded(cls.url, cls.mimeHint);
  if (!fetched.ok) {
    return { part: null, videoSeenSent: false, source: "none", warning: fetched.warning };
  }

  const canInline = !args.inlineDisallowed && fetched.bytes.byteLength <= INLINE_MAX_RAW;
  if (canInline) {
    return {
      part: {
        inline_data: {
          mime_type: fetched.mime,
          data: Buffer.from(fetched.bytes).toString("base64"),
        },
      },
      videoSeenSent: true,
      source: "storage_inline",
    };
  }

  if (!args.allowFilesApi) {
    return {
      part: null,
      videoSeenSent: false,
      source: "none",
      warning:
        "Video lớn — bỏ qua ở bản chấm thử; bản đầy đủ sẽ phân tích video ở chế độ nền.",
    };
  }

  const up = await uploadToFilesApi(fetched.bytes, fetched.mime, args.apiKey, args.deadlineAt);
  if ("error" in up) {
    return { part: null, videoSeenSent: false, source: "files_api", warning: up.error };
  }
  return {
    part: { file_data: { file_uri: up.uri, mime_type: up.mime } },
    videoSeenSent: true,
    source: "files_api",
  };
}
