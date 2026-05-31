/**
 * Nạp ảnh đính kèm (đã upload Storage, public URL) thành phần inline cho Gemini.
 * Server-only.
 */
import type { SubmissionAttachment } from "@/types/videoIntake";

export type GeminiImagePart = { data: string; mimeType: string };

const MAX_IMAGE_BYTES = 15 * 1024 * 1024; // 15MB / ảnh

/** Parse cột attachments (jsonb) -> SubmissionAttachment[] an toàn. */
export function parseAttachments(raw: unknown): SubmissionAttachment[] {
  if (!Array.isArray(raw)) return [];
  const out: SubmissionAttachment[] = [];
  for (const item of raw) {
    if (item && typeof item === "object") {
      const o = item as Record<string, unknown>;
      if (typeof o.drive_file_id === "string" || typeof o.web_url === "string") {
        out.push({
          drive_file_id:
            typeof o.drive_file_id === "string" ? o.drive_file_id : "",
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
 * Tải tối đa `max` ảnh (theo public URL) về base64 để đưa vào Gemini.
 * Bỏ qua ảnh lỗi/quá lớn (không làm fail pipeline).
 */
export async function loadImagePartsFromAttachments(
  attachments: SubmissionAttachment[] | null | undefined,
  max = 4,
): Promise<GeminiImagePart[]> {
  const imgs = (attachments ?? [])
    .filter((a) => a && a.kind === "image" && a.web_url)
    .slice(0, max);

  const parts: GeminiImagePart[] = [];
  for (const a of imgs) {
    try {
      const res = await fetch(a.web_url as string);
      if (!res.ok) continue;
      const arr = new Uint8Array(await res.arrayBuffer());
      if (arr.byteLength > MAX_IMAGE_BYTES) continue;
      const mime =
        a.mime_type || res.headers.get("content-type") || "image/jpeg";
      parts.push({ data: Buffer.from(arr).toString("base64"), mimeType: mime });
    } catch {
      // bỏ qua ảnh lỗi
    }
  }
  return parts;
}
