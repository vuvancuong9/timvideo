/**
 * Upload file lên Supabase Storage (thay cho Google Drive — service account
 * Drive không có quota nên không upload được vào My Drive).
 *
 * Luồng: server tạo "signed upload URL" (service role), client upload thẳng lên
 * Storage bằng token đó (không proxy bytes qua Vercel function). File ở bucket
 * public 'video-uploads' nên có publicUrl xem/tải trực tiếp.
 * Server-only.
 */
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ApiError } from "@/lib/http";

export const VIDEO_BUCKET = "video-uploads";

function safeName(name: string): string {
  const cleaned = (name || "file").replace(/[^\w.\-]+/g, "_");
  return cleaned.slice(-120) || "file";
}

function extOf(name: string): string {
  const m = name.match(/\.([a-zA-Z0-9]{1,8})$/);
  return m ? `.${m[1].toLowerCase()}` : "";
}

export type SignedUpload = {
  bucket: string;
  path: string;
  token: string;
  publicUrl: string;
};

export async function createSignedVideoUpload(params: {
  userId: string;
  fileName: string;
  /** Tên cơ sở mong muốn (vd Sub ID). Nếu có, file đặt tên theo nó + đuôi gốc. */
  baseName?: string | null;
  /** Số thứ tự khi nhiều file cùng 1 Sub ID (vd 2,3 cho ảnh). */
  index?: number;
}): Promise<SignedUpload> {
  const admin = createSupabaseAdminClient();
  const rand = Math.random().toString(36).slice(2, 6);

  let leaf: string;
  if (params.baseName) {
    const base = safeName(params.baseName);
    const suffix = params.index && params.index > 1 ? `-${params.index}` : "";
    leaf = `${base}${suffix}-${rand}${extOf(params.fileName)}`;
  } else {
    leaf = `${Date.now()}-${rand}-${safeName(params.fileName)}`;
  }
  const path = `${params.userId}/${leaf}`;

  const { data, error } = await admin.storage
    .from(VIDEO_BUCKET)
    .createSignedUploadUrl(path);
  if (error || !data) {
    throw new ApiError(
      502,
      `Không tạo được phiên upload Storage (${error?.message ?? "unknown"})`,
      "STORAGE_SIGN_FAILED",
    );
  }

  const { data: pub } = admin.storage.from(VIDEO_BUCKET).getPublicUrl(path);
  return {
    bucket: VIDEO_BUCKET,
    path: data.path,
    token: data.token,
    publicUrl: pub.publicUrl,
  };
}
