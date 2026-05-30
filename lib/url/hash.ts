/**
 * Băm canonical URL -> canonical_video_hash (server/test only: dùng node:crypto).
 * Đây là khóa chống trùng (unique index trên video_submissions.canonical_video_hash).
 */
import { createHash } from "node:crypto";
import type { VideoSource } from "@/lib/constants";
import { detectSource, normalizeVideoUrl } from "@/lib/url/canonical";

export function canonicalVideoHash(canonicalUrl: string): string {
  return createHash("sha256").update(canonicalUrl, "utf8").digest("hex");
}

export type CanonicalVideo = {
  source: VideoSource;
  canonicalUrl: string;
  hash: string;
};

export function canonicalizeVideo(rawUrl: string): CanonicalVideo {
  const canonicalUrl = normalizeVideoUrl(rawUrl);
  return {
    source: detectSource(rawUrl),
    canonicalUrl,
    hash: canonicalVideoHash(canonicalUrl),
  };
}
