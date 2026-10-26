/**
 * Upload video vào Google Drive CÁ NHÂN của admin qua OAuth (không phải service
 * account — vì SA Gmail có 0 quota). File do chính tài khoản admin sở hữu nên
 * dùng quota Drive của họ.
 *
 * Scope: drive (full) — cần để ghi vào folder admin TỰ TẠO sẵn (vd "Video Nhân
 * Viên Tìm"). Scope hẹp drive.file chỉ thấy file do app tạo nên không ghi được
 * vào folder ngoài. App ở chế độ Published nên refresh token không hết hạn.
 *
 * Credential lưu trong app_settings:
 *   GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET  (admin nhập)
 *   GOOGLE_OAUTH_REFRESH_TOKEN                          (callback tự lưu)
 *   GOOGLE_DRIVE_FOLDER_ID    (admin nhập — folder đích ưu tiên, vd 1qd6...)
 *   GOOGLE_OAUTH_FOLDER_ID    (app tự tạo & lưu — chỉ dùng khi admin chưa set folder)
 * Server-only.
 */
import { google } from "googleapis";
import { getSetting } from "@/lib/secrets";
import { invalidateSettingsCache } from "@/lib/secrets";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ApiError } from "@/lib/http";

// Full Drive scope: cần để ghi vào folder admin tự tạo (drive.file không thấy).
export const DRIVE_FILE_SCOPE = "https://www.googleapis.com/auth/drive";
const FOLDER_NAME = "timvideo-uploads";

/** Redirect URI cố định theo domain production (đăng ký trong Google Console). */
export function getRedirectUri(origin: string): string {
  return `${origin}/api/auth/google/callback`;
}

async function getClientCreds(): Promise<{ id: string; secret: string } | null> {
  const id = await getSetting("GOOGLE_OAUTH_CLIENT_ID");
  const secret = await getSetting("GOOGLE_OAUTH_CLIENT_SECRET");
  if (!id || !secret) return null;
  return { id, secret };
}

/** OAuth2 client (chưa gắn token). origin để dựng redirect uri. */
export async function makeOAuthClient(origin: string) {
  const creds = await getClientCreds();
  if (!creds) {
    throw new ApiError(
      500,
      "Chưa nhập GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET.",
      "OAUTH_NOT_CONFIGURED",
    );
  }
  return new google.auth.OAuth2({
    clientId: creds.id,
    clientSecret: creds.secret,
    redirectUri: getRedirectUri(origin),
    // Client được giữ giữa các request (xem getAuthorizedClient): nếu Google
    // thu hồi access token trước hạn thì 401 → tự xin token mới và gọi lại.
    forceRefreshOnFailure: true,
  });
}

/** URL đưa admin tới trang đồng ý của Google. */
export async function buildConsentUrl(origin: string): Promise<string> {
  const client = await makeOAuthClient(origin);
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent", // luôn xin refresh_token mới
    scope: [DRIVE_FILE_SCOPE],
  });
}

/** Đổi code lấy refresh_token, lưu vào app_settings. */
export async function exchangeAndStore(
  origin: string,
  code: string,
): Promise<void> {
  const client = await makeOAuthClient(origin);
  const { tokens } = await client.getToken(code);
  if (!tokens.refresh_token) {
    throw new ApiError(
      502,
      "Google không trả refresh_token. Hãy gỡ quyền cũ tại myaccount.google.com/permissions rồi kết nối lại.",
      "NO_REFRESH_TOKEN",
    );
  }
  const admin = createSupabaseAdminClient();
  await admin.from("app_settings").upsert(
    {
      key: "GOOGLE_OAUTH_REFRESH_TOKEN",
      value: tokens.refresh_token,
      is_secret: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );
  invalidateSettingsCache();
}

export async function isDriveOAuthConnected(): Promise<boolean> {
  const rt = await getSetting("GOOGLE_OAUTH_REFRESH_TOKEN");
  const creds = await getClientCreds();
  return Boolean(rt && creds);
}

type OAuthClient = Awaited<ReturnType<typeof makeOAuthClient>>;

/**
 * Giữ client giữa các request trong cùng instance: client tự nhớ access token
 * (~1 giờ) và chỉ refresh khi sắp hết hạn. Tạo client mới mỗi request thì lần
 * nào cũng phải gọi Google xin token (thêm ~0,3s cho mỗi lần tải file).
 */
let cachedClient: { key: string; client: OAuthClient } | null = null;

/** OAuth2 client đã gắn refresh token, sẵn sàng gọi Drive. */
async function getAuthorizedClient(origin = "https://timvideo.vercel.app") {
  const refreshToken = await getSetting("GOOGLE_OAUTH_REFRESH_TOKEN");
  if (!refreshToken) {
    throw new ApiError(500, "Chưa kết nối Google Drive (thiếu refresh token).", "OAUTH_NOT_CONNECTED");
  }
  const creds = await getClientCreds();
  const key = `${creds?.id}|${creds?.secret}|${refreshToken}`;
  if (cachedClient?.key === key) return cachedClient.client;

  const client = await makeOAuthClient(origin);
  client.setCredentials({ refresh_token: refreshToken });
  cachedClient = { key, client };
  return client;
}

/**
 * Xác định folder đích để upload:
 * 1) Ưu tiên GOOGLE_DRIVE_FOLDER_ID admin tự cấu hình (vd folder "Video Nhân
 *    Viên Tìm"). Với scope full drive, app ghi thẳng vào folder này được.
 * 2) Nếu chưa set, dùng GOOGLE_OAUTH_FOLDER_ID đã cache (app tự tạo trước đó).
 * 3) Nếu cũng chưa có, tự tạo folder "timvideo-uploads" rồi cache lại.
 */
async function ensureFolder(origin?: string): Promise<string> {
  const configured = await getSetting("GOOGLE_DRIVE_FOLDER_ID");
  if (configured && configured.trim()) return configured.trim();

  const cached = await getSetting("GOOGLE_OAUTH_FOLDER_ID");
  if (cached) return cached;

  const auth = await getAuthorizedClient(origin);
  const drive = google.drive({ version: "v3", auth });
  // tìm folder cũ do app tạo
  const found = await drive.files.list({
    q: `name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: "files(id,name)",
    spaces: "drive",
  });
  let folderId = found.data.files?.[0]?.id ?? null;
  if (!folderId) {
    const created = await drive.files.create({
      requestBody: {
        name: FOLDER_NAME,
        mimeType: "application/vnd.google-apps.folder",
      },
      fields: "id",
    });
    folderId = created.data.id ?? null;
  }
  if (!folderId) throw new ApiError(502, "Không tạo được folder Drive.");

  const admin = createSupabaseAdminClient();
  await admin.from("app_settings").upsert(
    {
      key: "GOOGLE_OAUTH_FOLDER_ID",
      value: folderId,
      is_secret: false,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );
  invalidateSettingsCache();
  return folderId;
}

const RESUMABLE_ENDPOINT =
  "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,webViewLink";

/** Tạo resumable session trong Drive admin. Browser PUT thẳng file lên uploadUrl. */
export async function createOAuthResumableSession(params: {
  fileName: string;
  mimeType: string;
  fileSize?: number;
  origin?: string;
}): Promise<{ uploadUrl: string; folderId: string }> {
  const folderId = await ensureFolder(params.origin);
  const startSession = async () => {
    const auth = await getAuthorizedClient(params.origin);
    const { token } = await auth.getAccessToken();
    if (!token) throw new ApiError(502, "Không lấy được access token Google.");
    return fetch(RESUMABLE_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": params.mimeType || "application/octet-stream",
        // QUAN TRỌNG cho CORS: Origin của request KHỞI TẠO quyết định
        // Access-Control-Allow-Origin cho cả phiên resumable. Nếu thiếu, trình
        // duyệt PUT thẳng lên session URL sẽ bị chặn ("Lỗi mạng khi upload Drive").
        ...(params.origin ? { Origin: params.origin } : {}),
        ...(params.fileSize
          ? { "X-Upload-Content-Length": String(params.fileSize) }
          : {}),
      },
      body: JSON.stringify({ name: params.fileName, parents: [folderId] }),
    });
  };

  let res = await startSession();
  if (res.status === 401) {
    // Token đang nhớ bị Google từ chối trước hạn (thu hồi...) → bỏ, xin lại.
    await res.body?.cancel().catch(() => {});
    cachedClient = null;
    res = await startSession();
  }
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    // Drive của tài khoản Google đã kết nối bị đầy dung lượng (Google free = 15GB
    // dùng chung Gmail + Photos + Drive). Google trả 403 storageQuotaExceeded.
    if (res.status === 403 && /storageQuotaExceeded/i.test(t)) {
      throw new ApiError(
        507,
        "Google Drive của tài khoản đang kết nối đã HẾT dung lượng nên không upload được video. " +
          "Cách khắc phục: (1) Vào drive.google.com dọn bớt file / xoá thùng rác để trống chỗ, " +
          "hoặc (2) Mua thêm dung lượng Google One, hoặc (3) Vào /admin/settings → nhóm 'Google Drive (cá nhân)' " +
          "để kết nối lại bằng một tài khoản Google khác còn trống dung lượng.",
        "DRIVE_QUOTA_EXCEEDED",
      );
    }
    throw new ApiError(502, `Drive tạo phiên upload lỗi (${res.status}). ${t}`.slice(0, 400));
  }
  const uploadUrl = res.headers.get("location");
  if (!uploadUrl) throw new ApiError(502, "Drive không trả upload URL.");
  return { uploadUrl, folderId };
}

export type DriveOAuthMeta = {
  fileId: string;
  name: string | null;
  webViewLink: string | null;
  directUrl: string | null;
};

/**
 * Chỉ thao tác trên file nằm trong folder upload: route nhận fileId từ trình
 * duyệt, mà client OAuth có quyền toàn bộ Drive của admin.
 */
async function getUploadFile(fileId: string, origin?: string) {
  const auth = await getAuthorizedClient(origin);
  const drive = google.drive({ version: "v3", auth });
  const folderId = await ensureFolder(origin);
  const { data } = await drive.files.get({
    fileId,
    fields: "id,name,webViewLink,parents,createdTime,trashed",
  });
  if (!(data.parents ?? []).includes(folderId)) {
    throw new ApiError(403, "File không thuộc thư mục upload của hệ thống.", "NOT_UPLOAD_FILE");
  }
  return { drive, data };
}

const DISCARD_MAX_AGE_MS = 24 * 60 * 60_000;

/**
 * Bỏ file nhân viên đã tải ngầm nhưng không gửi (xoá/đổi file, đóng tab).
 * Chỉ chuyển vào thùng rác (khôi phục được 30 ngày) và chỉ khi file còn RIÊNG
 * TƯ: file của submission/chấm thử luôn được cấp quyền "anyone" trước khi
 * dùng, nên file riêng tư không thể đang được tham chiếu.
 */
export async function discardUnpublishedUpload(
  fileId: string,
  origin?: string,
): Promise<boolean> {
  const { drive, data } = await getUploadFile(fileId, origin);
  if (data.trashed) return true;
  const created = data.createdTime ? Date.parse(data.createdTime) : NaN;
  if (!Number.isFinite(created) || Date.now() - created > DISCARD_MAX_AGE_MS) return false;
  const perms = await drive.permissions.list({ fileId, fields: "permissions(type)" });
  if ((perms.data.permissions ?? []).some((p) => p.type === "anyone")) return false;
  await drive.files.update({ fileId, requestBody: { trashed: true } });
  return true;
}

/** Sau khi upload: cấp quyền xem-theo-link + lấy metadata. */
export async function finalizeOAuthDriveFile(
  fileId: string,
  origin?: string,
): Promise<DriveOAuthMeta> {
  const { drive, data } = await getUploadFile(fileId, origin);
  await drive.permissions
    .create({ fileId, requestBody: { role: "reader", type: "anyone" } })
    .catch(() => null); // bỏ qua nếu không set được
  return {
    fileId: data.id ?? fileId,
    name: data.name ?? null,
    webViewLink: data.webViewLink ?? null,
    // URL tải trực tiếp (Gemini đọc ảnh được khi file anyone-reader)
    directUrl: `https://drive.google.com/uc?export=view&id=${data.id ?? fileId}`,
  };
}
