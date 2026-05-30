/**
 * Hash canonical URL + kiểm tra trùng (server-only: dùng node:crypto + service role).
 */
import { createHash } from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  canonicalizeVideoUrl,
  detectVideoSource,
} from "@/lib/video-intake/normalize-url";
import type {
  DuplicateCheckResult,
  VideoSourceType,
} from "@/types/videoIntake";

/** sha256 hex của canonical URL — khóa chống trùng. */
export function hashCanonicalUrl(canonical: string): string {
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

/** sha256 hex của một Buffer/ArrayBuffer (dùng cho file_sha256). */
export function hashBuffer(buf: Buffer | Uint8Array): string {
  return createHash("sha256").update(buf).digest("hex");
}

export type Canonicalized = {
  sourceType: VideoSourceType;
  canonicalUrl: string;
  canonicalHash: string;
};

/** Canonicalize 1 URL → {source, canonicalUrl, hash}. */
export function canonicalizeForDedup(rawUrl: string): Canonicalized {
  const canonicalUrl = canonicalizeVideoUrl(rawUrl);
  return {
    sourceType: detectVideoSource(rawUrl),
    canonicalUrl,
    canonicalHash: hashCanonicalUrl(canonicalUrl),
  };
}

/**
 * Kiểm tra trùng TOÀN HỆ THỐNG bằng service role (vượt RLS) nhưng chỉ trả về
 * thông tin tối thiểu (id, người tạo, ngày, trạng thái) — KHÔNG lộ dữ liệu
 * nhạy cảm của nhân viên khác.
 */
export async function checkDuplicateByUrl(
  rawUrl: string,
): Promise<DuplicateCheckResult> {
  const { sourceType, canonicalUrl, canonicalHash } =
    canonicalizeForDedup(rawUrl);

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("video_submissions")
    .select(
      "id, created_at, status, creator:profiles!video_submissions_created_by_fkey(full_name)",
    )
    .eq("canonical_video_hash", canonicalHash)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    return {
      ok: true,
      duplicate: false,
      canonical_video_url: canonicalUrl,
      canonical_video_hash: canonicalHash,
      source_type: sourceType,
    };
  }

  const creator = data.creator as { full_name: string | null } | null;
  return {
    ok: true,
    duplicate: true,
    existing: {
      id: data.id,
      created_by_name: creator?.full_name ?? null,
      created_at: data.created_at,
      status: data.status,
    },
    canonical_video_url: canonicalUrl,
    canonical_video_hash: canonicalHash,
    source_type: sourceType,
  };
}

/** Kiểm tra trùng theo file_sha256 (cảnh báo, không bắt buộc chặn). */
export async function checkDuplicateByFileSha(
  fileSha256: string,
): Promise<{ duplicate: boolean; existingId?: string }> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("video_submissions")
    .select("id")
    .eq("file_sha256", fileSha256)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? { duplicate: true, existingId: data.id } : { duplicate: false };
}
