import { google } from "googleapis";
import { ApiError } from "@/lib/http";
import { getSetting } from "@/lib/secrets";

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";
const RESUMABLE_ENDPOINT =
  "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true&fields=id,name,webViewLink,parents";

/** JWT auth Drive — đọc credential từ app_settings (DB) hoặc env. */
export async function getDriveJwtAuth() {
  const clientEmail = await getSetting("GOOGLE_DRIVE_CLIENT_EMAIL");
  const privateKey = await getSetting("GOOGLE_DRIVE_PRIVATE_KEY");
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

export async function getDriveFolderId(): Promise<string> {
  const folderId = await getSetting("GOOGLE_DRIVE_FOLDER_ID");
  if (!folderId) {
    throw new ApiError(
      500,
      "Thiếu GOOGLE_DRIVE_FOLDER_ID.",
      "DRIVE_NOT_CONFIGURED",
    );
  }
  return folderId;
}

/**
 * Tạo phiên resumable upload. Trả uploadUrl để client PUT thẳng file lên Google
 * (KHÔNG proxy bytes qua server). File nằm trong GOOGLE_DRIVE_FOLDER_ID.
 */
export async function createResumableUploadSession(params: {
  fileName: string;
  mimeType: string;
  fileSize?: number;
}): Promise<{ uploadUrl: string; folderId: string }> {
  const auth = await getDriveJwtAuth();
  const folderId = await getDriveFolderId();
  let accessToken: string | null | undefined;
  try {
    const creds = await auth.authorize();
    accessToken = creds.access_token;
  } catch (err) {
    throw new ApiError(
      502,
      `Google Drive xác thực thất bại — kiểm tra GOOGLE_DRIVE_CLIENT_EMAIL / PRIVATE_KEY (private key phải dán nguyên, gồm cả dòng BEGIN/END). Chi tiết: ${
        err instanceof Error ? err.message : String(err)
      }`.slice(0, 400),
      "DRIVE_AUTH_FAILED",
    );
  }
  if (!accessToken) {
    throw new ApiError(502, "Không lấy được access token Google Drive.");
  }

  const metadata = { name: params.fileName, parents: [folderId] };
  const res = await fetch(RESUMABLE_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": params.mimeType || "application/octet-stream",
      ...(params.fileSize
        ? { "X-Upload-Content-Length": String(params.fileSize) }
        : {}),
    },
    body: JSON.stringify(metadata),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new ApiError(
      502,
      `Không tạo được phiên upload Drive (${res.status}). ${text}`.trim(),
    );
  }

  const uploadUrl = res.headers.get("location");
  if (!uploadUrl) {
    throw new ApiError(502, "Google Drive không trả về upload URL (Location).");
  }
  return { uploadUrl, folderId };
}

export type DriveFileMeta = {
  driveFileId: string;
  driveFileName: string | null;
  driveWebUrl: string | null;
  driveFolderId: string | null;
};

/** Sau khi client upload xong: cấp quyền xem theo link + lấy metadata file. */
export async function finalizeDriveFile(fileId: string): Promise<DriveFileMeta> {
  const auth = await getDriveJwtAuth();
  const drive = google.drive({ version: "v3", auth });

  try {
    await drive.permissions.create({
      fileId,
      requestBody: { role: "reader", type: "anyone" },
      supportsAllDrives: true,
    });
  } catch (err) {
    console.warn("[drive] set public permission failed:", err);
  }

  const { data } = await drive.files.get({
    fileId,
    fields: "id,name,webViewLink,parents",
    supportsAllDrives: true,
  });

  return {
    driveFileId: data.id ?? fileId,
    driveFileName: data.name ?? null,
    driveWebUrl: data.webViewLink ?? null,
    driveFolderId: data.parents?.[0] ?? (await getDriveFolderId()),
  };
}
