import { google } from "googleapis";
import { ApiError } from "@/lib/http";
import { getSetting } from "@/lib/secrets";

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";
const RESUMABLE_ENDPOINT =
  "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true&fields=id,name,webViewLink,parents";

/**
 * Bóc tách credential Drive một cách "chịu lỗi":
 * - Chấp nhận dán RIÊNG private key (PEM), HOẶC dán CẢ FILE JSON service account
 *   vào ô GOOGLE_DRIVE_PRIVATE_KEY (tự lấy private_key + client_email).
 * - Tự chuẩn hóa \n (literal) thành xuống dòng thật.
 */
export function extractDriveCreds(
  rawKey: string,
  rawEmail: string | undefined,
): { email: string; privateKey: string } {
  let text = (rawKey ?? "").trim();
  // gỡ 1 lớp nháy kép bao ngoài nếu có
  if (text.startsWith('"') && text.endsWith('"') && text.length > 1) {
    text = text.slice(1, -1);
  }
  // sửa trường hợp bị nhân đôi nháy ("") khi copy
  if (text.includes('""')) text = text.replace(/""/g, '"');

  let email = (rawEmail ?? "").trim();
  let privateKey = text;

  // Nếu là cả JSON service account -> lấy client_email từ đó (nếu ô email trống).
  if (text.includes('"client_email"') && !email) {
    const m = text.match(/"client_email"\s*:\s*"([^"]+)"/);
    if (m) email = m[1];
  }

  // Lấy thẳng khối PEM (chắc chắn nhất), dù nằm trong JSON hay không.
  const pem = text.match(
    /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/,
  );
  if (pem) privateKey = pem[0];

  privateKey = privateKey.replace(/\\n/g, "\n").trim();
  return { email, privateKey };
}

/** JWT auth Drive — đọc credential từ app_settings (DB) hoặc env. */
export async function getDriveJwtAuth() {
  const rawEmail = await getSetting("GOOGLE_DRIVE_CLIENT_EMAIL");
  const rawKey = await getSetting("GOOGLE_DRIVE_PRIVATE_KEY");
  if (!rawKey) {
    throw new ApiError(
      500,
      "Chưa cấu hình Google Drive (GOOGLE_DRIVE_PRIVATE_KEY).",
      "DRIVE_NOT_CONFIGURED",
    );
  }
  const { email, privateKey } = extractDriveCreds(rawKey, rawEmail);
  if (!email) {
    throw new ApiError(
      500,
      "Thiếu GOOGLE_DRIVE_CLIENT_EMAIL (hoặc client_email trong JSON).",
      "DRIVE_NOT_CONFIGURED",
    );
  }
  if (!privateKey.includes("PRIVATE KEY")) {
    throw new ApiError(
      500,
      "GOOGLE_DRIVE_PRIVATE_KEY không hợp lệ — cần là private key (PEM) hoặc cả file JSON service account.",
      "DRIVE_KEY_INVALID",
    );
  }
  return new google.auth.JWT({
    email,
    key: privateKey,
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
