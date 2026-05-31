/**
 * Nạp ảnh đính kèm (đã upload Drive) thành phần inline cho Gemini.
 * Server-only.
 */
import { fetchDriveImageBase64 } from "@/lib/video-intake/drive";
import type { SubmissionAttachment } from "@/types/videoIntake";

export type GeminiImagePart = { data: string; mimeType: string };

/** Parse cột attachments (jsonb) -> SubmissionAttachment[] an toàn. */
export function parseAttachments(raw: unknown): SubmissionAttachment[] {
  if (!Array.isArray(raw)) return [];
  const out: SubmissionAttachment[] = [];
  for (const item of raw) {
    if (item && typeof item === "object") {
      const o = item as Record<string, unknown>;
      if (typeof o.drive_file_id === "string") {
        out.push({
          drive_file_id: o.drive_file_id,
          name: typeof o.name === "string" ? o.name : null,
          web_url: typeof o.web_url === "string" ? o.web_url : null,
          mime_type: typeof o.mime_type === "string" ? o.mime_type : null,
          kind: o.kind === "image" ? "image" : "video",
        });
      }
    }
  }
  return out;
}

/**
 * Tải tối đa `max` ảnh từ attachments về dạng base64 để đưa vào Gemini.
 * Bỏ qua ảnh lỗi/không tải được (không làm fail cả pipeline).
 */
export async function loadImagePartsFromAttachments(
  attachments: SubmissionAttachment[] | null | undefined,
  max = 4,
): Promise<GeminiImagePart[]> {
  const imgs = (attachments ?? [])
    .filter((a) => a && a.kind === "image" && a.drive_file_id)
    .slice(0, max);
  const parts: GeminiImagePart[] = [];
  for (const a of imgs) {
    try {
      const p = await fetchDriveImageBase64(a.drive_file_id);
      if (p) parts.push(p);
    } catch {
      // bỏ qua ảnh lỗi
    }
  }
  return parts;
}
