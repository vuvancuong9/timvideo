import { describe, expect, it } from "vitest";
import {
  classifyVideoSource,
  reconcileEvidence,
  coerceEvidenceLevel,
  toDirectFetchUrl,
} from "@/lib/video-review/gemini-video-input";
import type { SubmissionAttachment } from "@/types/videoIntake";

type Args = {
  sourceType: string;
  originalVideoUrl: string | null;
  driveWebUrl: string | null;
  attachments: SubmissionAttachment[];
};
const mk = (over: Partial<Args>): Args => ({
  sourceType: "other_url",
  originalVideoUrl: null,
  driveWebUrl: null,
  attachments: [],
  ...over,
});

describe("classifyVideoSource", () => {
  it("YouTube source → youtube (không fetch)", () => {
    const r = classifyVideoSource(
      mk({ sourceType: "youtube_url", originalVideoUrl: "https://youtu.be/abc123" }),
    );
    expect(r.kind).toBe("youtube");
  });

  it("nhận diện YouTube từ URL dù sourceType khác", () => {
    const r = classifyVideoSource(
      mk({ originalVideoUrl: "https://www.youtube.com/watch?v=abc123" }),
    );
    expect(r.kind).toBe("youtube");
  });

  it("file mode (drive_upload) + driveWebUrl → fetch", () => {
    const r = classifyVideoSource(
      mk({
        sourceType: "drive_upload",
        driveWebUrl:
          "https://x.supabase.co/storage/v1/object/public/video-uploads/1.mp4",
      }),
    );
    expect(r.kind).toBe("fetch");
  });

  it("file mode + attachment video → fetch", () => {
    const r = classifyVideoSource(
      mk({
        sourceType: "drive_upload",
        attachments: [
          {
            drive_file_id: "",
            name: "v.mp4",
            web_url: "https://x/v.mp4",
            mime_type: "video/mp4",
            kind: "video",
          },
        ],
      }),
    );
    expect(r.kind).toBe("fetch");
  });

  it("file mode nhưng chưa có file → none", () => {
    const r = classifyVideoSource(mk({ sourceType: "drive_upload" }));
    expect(r.kind).toBe("none");
  });

  it("link mode (tiktok) dù có file vẫn theo link → none (tôn trọng lựa chọn)", () => {
    const r = classifyVideoSource(
      mk({
        sourceType: "tiktok_url",
        originalVideoUrl: "https://www.tiktok.com/@a/video/1",
        driveWebUrl: "https://x/v.mp4",
      }),
    );
    expect(r.kind).toBe("none");
  });

  it("TikTok không file → none + warning (KHÔNG gửi link làm video)", () => {
    const r = classifyVideoSource(
      mk({ sourceType: "tiktok_url", originalVideoUrl: "https://www.tiktok.com/@a/video/1" }),
    );
    expect(r.kind).toBe("none");
    if (r.kind === "none") expect(r.warning.length).toBeGreaterThan(0);
  });

  it("Facebook không file → none", () => {
    const r = classifyVideoSource(
      mk({ sourceType: "facebook_url", originalVideoUrl: "https://facebook.com/watch?v=1" }),
    );
    expect(r.kind).toBe("none");
  });
});

describe("reconcileEvidence (lấy MIN — model không thể tự nâng)", () => {
  it("code video + model text_only → text_only (model nói không thấy)", () => {
    expect(reconcileEvidence("video", "text_only")).toBe("text_only");
  });
  it("code text_only + model video → text_only (model không nâng quá code)", () => {
    expect(reconcileEvidence("text_only", "video")).toBe("text_only");
  });
  it("cả hai video → video", () => {
    expect(reconcileEvidence("video", "video")).toBe("video");
  });
  it("code images_only + model frames → images_only", () => {
    expect(reconcileEvidence("images_only", "frames")).toBe("images_only");
  });
});

describe("toDirectFetchUrl (Google Drive view -> tải trực tiếp)", () => {
  it("file/d/ID/view -> uc?export=download", () => {
    expect(
      toDirectFetchUrl("https://drive.google.com/file/d/ABC123/view?usp=drivesdk"),
    ).toBe("https://drive.google.com/uc?export=download&id=ABC123");
  });
  it("open?id=ID -> uc?export=download", () => {
    expect(toDirectFetchUrl("https://drive.google.com/open?id=XYZ789")).toBe(
      "https://drive.google.com/uc?export=download&id=XYZ789",
    );
  });
  it("Supabase Storage URL giữ nguyên", () => {
    const u =
      "https://x.supabase.co/storage/v1/object/public/video-uploads/a/b.mp4";
    expect(toDirectFetchUrl(u)).toBe(u);
  });
  it("YouTube URL giữ nguyên", () => {
    const u = "https://www.youtube.com/watch?v=abc";
    expect(toDirectFetchUrl(u)).toBe(u);
  });
});

describe("coerceEvidenceLevel", () => {
  it("giá trị lạ/thiếu → text_only", () => {
    expect(coerceEvidenceLevel("banana")).toBe("text_only");
    expect(coerceEvidenceLevel(undefined)).toBe("text_only");
    expect(coerceEvidenceLevel(null)).toBe("text_only");
  });
  it("giá trị hợp lệ giữ nguyên", () => {
    expect(coerceEvidenceLevel("frames")).toBe("frames");
    expect(coerceEvidenceLevel("video")).toBe("video");
  });
});
