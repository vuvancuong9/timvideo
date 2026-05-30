/**
 * Google Drive upload cho module video-intake.
 * Tái dùng resumable-session từ lib/drive.ts (đã có sẵn từ module trước),
 * bổ sung tải file tạm về buffer để worker extract (giới hạn kích thước).
 */
export {
  createResumableUploadSession,
  finalizeDriveFile,
  getDriveFolderId,
  type DriveFileMeta,
} from "@/lib/drive";

import { google } from "googleapis";
import { ApiError } from "@/lib/http";

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";

/** Giới hạn tải file về server để extract (MVP). Trên ngưỡng này worker bỏ qua. */
export const MAX_DOWNLOAD_BYTES = 100 * 1024 * 1024; // 100MB

function getJwtAuth() {
  const clientEmail = process.env.GOOGLE_DRIVE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_DRIVE_PRIVATE_KEY;
  if (!clientEmail || !privateKey) {
    throw new ApiError(
      500,
      "Chưa cấu hình Google Drive (GOOGLE_DRIVE_CLIENT_EMAIL / GOOGLE_DRIVE_PRIVATE_KEY).",
      "DRIVE_NOT_CONFIGURED",
    );
  }
  return new google.auth.JWT({
    email: clientEmail,
    key: privateKey.replace(/\\n/g, "\n"),
    scopes: [DRIVE_SCOPE],
  });
}

export type DriveFileInfo = {
  id: string;
  name: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  webViewLink: string | null;
};

/** Lấy metadata file Drive (không tải nội dung). */
export async function getDriveFileInfo(fileId: string): Promise<DriveFileInfo> {
  const auth = getJwtAuth();
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
  const auth = getJwtAuth();
  const drive = google.drive({ version: "v3", auth });
  const res = await drive.files.get(
    { fileId, alt: "media", supportsAllDrives: true },
    { responseType: "arraybuffer" },
  );
  return Buffer.from(res.data as ArrayBuffer);
}
