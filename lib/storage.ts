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

export type SignedUpload = {
  bucket: string;
  path: string;
  token: string;
  publicUrl: string;
};

export async function createSignedVideoUpload(params: {
  userId: string;
  fileName: string;
}): Promise<SignedUpload> {
  const admin = createSupabaseAdminClient();
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  const path = `${params.userId}/${ts}-${rand}-${safeName(params.fileName)}`;

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
