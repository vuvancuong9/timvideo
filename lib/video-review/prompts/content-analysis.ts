/** Prompt phân tích nội dung video bằng Gemini cho mục tiêu REVIEW/LAN TỎA. */

export type ContentAnalysisPromptInput = {
  productCategory: string | null;
  shopeeProductUrl: string;
  productPrice: number;
  commissionPercent: number;
  sourceType: string;
  videoUrl: string | null;
  driveWebUrl: string | null;
  transcript: string | null;
  ocrText: string | null;
  frameCount: number;
  imageCount: number;
  hasVideoFile: boolean;
  /** Code đã gửi VIDEO THẬT vào Gemini lần này chưa. */
  videoProvided: boolean;
  /** Mức bằng chứng code chốt (đối chiếu lại với model). */
  evidenceLevel: "video" | "frames" | "images_only" | "text_only";
  videoSeen: boolean;
  /** Cảnh báo khi build video input (vd link không tải được). */
  videoInputWarnings: string[];
};

export const CONTENT_ANALYSIS_SYSTEM_PROMPT = `Bạn là chuyên gia đánh giá video REVIEW sản phẩm cho mục tiêu lan tỏa tự nhiên và chạy quảng cáo an toàn trên Meta/Facebook.

Mục tiêu video (KHÔNG phải chỉ bán hàng):
- Cần là video REVIEW/CHIA SẺ THẬT.
- Ưu tiên nội dung giữ chân người xem, tạo niềm tin, có bằng chứng SỬ DỤNG sản phẩm.
- Chỉ đánh giá cao nếu video vừa có giá trị review, vừa có lý do để người xem xem tiếp / lưu / chia sẻ.

Một số ảnh đính kèm là ẢNH CHỤP SỐ LIỆU TƯƠNG TÁC (like/view/comment/share) — đọc số liệu, đánh giá "social proof", ghi vào "summary".

NGUYÊN TẮC CỨNG:
1. Nếu chỉ cầm sản phẩm + hiện giá sale + caption săn deal mà KHÔNG test/demo/cảm nhận → "video_type"="sales_deal", "is_real_review"=false.
2. Nếu KHÔNG có video thật / frame / transcript / OCR → "evidence_level"="text_only" (hoặc "images_only" nếu có ảnh), "video_seen"=false, "confidence" KHÔNG được "high". Nói rõ trong "summary": "chưa có video thật để phân tích, đây là đánh giá sơ bộ".
3. Nếu CÓ video thật: XEM video, mô tả đúng cái thấy, liệt kê "key_moments" + "observed_evidence" KÈM MỐC THỜI GIAN (mm:ss). "video_seen"=true, "evidence_level"="video".
4. KHÔNG bịa cảnh sử dụng / transcript / claim / số liệu.
5. "expert_diagnosis": chỉ ra main_problem + vì sao chưa đủ review (why_not_review) + chưa đủ lan tỏa (why_not_viral_enough) + cách sửa (recommended_fix).
6. "policy_visible_evidence": dấu hiệu rủi ro chính sách NHÌN THẤY trực tiếp (vd "giá ❌139 ✅79", "logo thương hiệu", "before/after", "nhạc nền có bản quyền"). Không thấy → mảng rỗng.

Cần phân tích: có thực sự review không? có test/swatch/demo/mở hộp/dùng thực tế không? có nêu ưu/nhược điểm không? có hook giữ người xem không? có khả năng lan tỏa/chia sẻ/lưu không? có claim giá/hiệu quả gây hiểu nhầm không? có dấu hiệu bản quyền/nhạc/logo/UGC cần kiểm tra không?

CHỈ trả về JSON đúng schema, không thêm chữ nào ngoài JSON.`;

export function buildContentAnalysisUserPrompt(
  input: ContentAnalysisPromptInput,
): string {
  const lines = [
    `Danh mục: ${input.productCategory ?? "(không rõ)"}`,
    `Link Shopee: ${input.shopeeProductUrl}`,
    `Giá: ${input.productPrice} | % hoa hồng: ${input.commissionPercent}`,
    `Nguồn video: ${input.sourceType}`,
    `Link video: ${input.videoUrl ?? "(không có)"}`,
    `Số ảnh đính kèm: ${input.imageCount}`,
    input.videoProvided
      ? "VIDEO THẬT đã được đính kèm trong request — hãy XEM và phân tích trực tiếp (observed_evidence kèm mm:ss)."
      : "KHÔNG có video thật trong request (chỉ link/ảnh) — đánh giá SƠ BỘ, KHÔNG mô tả cảnh như đã xem.",
    input.videoInputWarnings.length
      ? `Cảnh báo nguồn video: ${input.videoInputWarnings.join("; ")}`
      : "",
    "",
    `Transcript: ${input.transcript ?? "(không có)"}`,
    `OCR: ${input.ocrText ?? "(không có)"}`,
    "",
    "Trả về JSON strict đúng schema sau:",
    JSON.stringify(
      {
        objective: "review_share_viral",
        evidence_level: input.videoProvided ? "video" : "images_only|text_only",
        video_seen: input.videoProvided,
        video_type:
          "review|sales_deal|unboxing|demo|comparison|testimonial|unknown",
        is_real_review: false,
        summary: "...",
        hook_3s: "...",
        visual_summary: "...",
        product_detected: "...",
        claims_detected: ["..."],
        pain_points: ["..."],
        audience_profile: {},
        key_moments: ["00:00-00:03 ..."],
        strong_scenes: ["..."],
        weak_scenes: ["..."],
        remake_angles: ["..."],
        observed_evidence: [
          {
            timestamp: "00:00-00:03",
            evidence: "...",
            affects: ["review_depth_score", "viral_hook_score"],
          },
        ],
        expert_diagnosis: {
          main_problem: "...",
          why_not_review: ["..."],
          why_not_viral_enough: ["..."],
          recommended_fix: ["..."],
        },
        policy_visible_evidence: ["..."],
        confidence: "low|medium|high",
      },
      null,
      2,
    ),
  ];
  return lines.join("\n");
}
