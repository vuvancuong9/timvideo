/**
 * Google Drive upload cho module video-intake.
 * Tái dùng resumable-session + JWT auth từ lib/drive.ts, bổ sung tải file tạm
 * về buffer để worker extract (giới hạn kích thước).
 */
export {
  createResumableUploadSession,
  finalizeDriveFile,
  getDriveFolderId,
  getDriveJwtAuth,
  type DriveFileMeta,
} from "@/lib/drive";

import { google } from "googleapis";
import { getDriveJwtAuth } from "@/lib/drive";

/** Giới hạn tải file về server để extract (MVP). Trên ngưỡng này worker bỏ qua. */
export const MAX_DOWNLOAD_BYTES = 100 * 1024 * 1024; // 100MB

export type DriveFileInfo = {
  id: string;
  name: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  webViewLink: string | null;
};

/** Lấy metadata file Drive (không tải nội dung). */
export async function getDriveFileInfo(fileId: string): Promise<DriveFileInfo> {
  const auth = await getDriveJwtAuth();
  const drive = google.drive({ version: "v3", auth });
  const { data } = await drive.files.get({
    fileId,
    fields: "id,name,mimeType,size,webViewLink",
    supportsAllDrives: true,
  });
  return {
    id: data.id ?? fileId,
    name: data.name ?? null,
    mimeType: data.mimeType ?? null,
    sizeBytes: data.size ? Number(data.size) : null,
    webViewLink: data.webViewLink ?? null,
  };
}

/**
 * Lấy nội dung ảnh Drive dưới dạng base64 để gửi cho Gemini (đọc ảnh số liệu
 * tương tác like/view/comment). Chỉ nhận file ảnh, cap 15MB. Trả null nếu không hợp lệ.
 */
export async function fetchDriveImageBase64(
  fileId: string,
): Promise<{ data: string; mimeType: string } | null> {
  const info = await getDriveFileInfo(fileId);
  const mime = info.mimeType ?? "";
  if (!mime.startsWith("image/")) return null;
  const buf = await downloadDriveFileBuffer(fileId, 15 * 1024 * 1024);
  if (!buf) return null;
  return { data: buf.toString("base64"), mimeType: mime };
}

/**
 * Tải file Drive về Buffer (chỉ khi <= MAX_DOWNLOAD_BYTES). Trả null nếu quá lớn.
 * TODO: với file lớn nên stream ra storage tạm thay vì giữ trong memory.
 */
export async function downloadDriveFileBuffer(
  fileId: string,
  maxBytes: number = MAX_DOWNLOAD_BYTES,
): Promise<Buffer | null> {
  const info = await getDriveFileInfo(fileId);
  if (info.sizeBytes && info.sizeBytes > maxBytes) {
    return null;
  }
  const auth = await getDriveJwtAuth();
  const drive = google.drive({ version: "v3", auth });
  const res = await drive.files.get(
    { fileId, alt: "media", supportsAllDrives: true },
    { responseType: "arraybuffer" },
  );
  return Buffer.from(res.data as ArrayBuffer);
}
