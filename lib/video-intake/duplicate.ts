/**
 * Hash canonical URL + kiểm tra trùng (server-only: dùng node:crypto + service role).
 */
import { createHash } from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  canonicalizeVideoUrl,
  detectVideoSource,
  videoExternalId,
} from "@/lib/video-intake/normalize-url";
import { resolveShortLink } from "@/lib/video-intake/resolve-url";
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
  /** Khóa ID video gốc `platform:id` (mạnh hơn hash URL), null nếu không trích được. */
  externalId: string | null;
};

/**
 * Canonicalize 1 URL (ĐỒNG BỘ, không resolve link rút gọn).
 * Dùng cho test/đường dẫn không cần gọi mạng. Để chống trùng đầy đủ (có resolve
 * link rút gọn) hãy dùng resolveAndCanonicalize().
 */
export function canonicalizeForDedup(rawUrl: string): Canonicalized {
  const canonicalUrl = canonicalizeVideoUrl(rawUrl);
  return {
    sourceType: detectVideoSource(rawUrl),
    canonicalUrl,
    canonicalHash: hashCanonicalUrl(canonicalUrl),
    externalId: videoExternalId(rawUrl),
  };
}

/**
 * Như canonicalizeForDedup nhưng RESOLVE link rút gọn trước (server-only).
 * vt/vm.tiktok.com, fb.watch -> URL đầy đủ -> trích đúng ID video. Là điểm vào
 * chuẩn để chống trùng khi GHI/KIỂM TRA submission.
 */
export async function resolveAndCanonicalize(
  rawUrl: string,
): Promise<Canonicalized> {
  const resolved = await resolveShortLink(rawUrl);
  return canonicalizeForDedup(resolved);
}

/**
 * Kiểm tra trùng TOÀN HỆ THỐNG bằng service role (vượt RLS) nhưng chỉ trả về
 * thông tin tối thiểu (id, người tạo, ngày, trạng thái) — KHÔNG lộ dữ liệu
 * nhạy cảm của nhân viên khác.
 */
export async function checkDuplicateByUrl(
  rawUrl: string,
): Promise<DuplicateCheckResult> {
  const { sourceType, canonicalUrl, canonicalHash, externalId } =
    await resolveAndCanonicalize(rawUrl);

  const admin = createSupabaseAdminClient();
  const cols =
    "id, created_at, status, creator:profiles!video_submissions_created_by_fkey(full_name)";

  // Ưu tiên khớp theo ID video gốc (mạnh nhất), sau đó tới canonical hash.
  type ExistingDupRow = {
    id: string;
    created_at: string;
    status: string;
    creator: { full_name: string | null } | null;
  };
  let data: ExistingDupRow | null = null;
  if (externalId) {
    const r = await admin
      .from("video_submissions")
      .select(cols)
      .eq("video_external_id", externalId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (r.error) throw r.error;
    data = r.data as unknown as ExistingDupRow | null;
  }
  if (!data) {
    const r = await admin
      .from("video_submissions")
      .select(cols)
      .eq("canonical_video_hash", canonicalHash)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (r.error) throw r.error;
    data = r.data as unknown as ExistingDupRow | null;
  }

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
