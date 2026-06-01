/** Prompt phân tích nội dung video bằng Gemini (strict JSON). */

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
  /** Có gửi VIDEO THẬT vào Gemini lần này không (file/uri) — quyết định cách chấm. */
  videoProvided: boolean;
};

export const CONTENT_ANALYSIS_SYSTEM_PROMPT = `Bạn là chuyên gia phân tích video sản phẩm để bán affiliate.
Phân tích dựa trên dữ liệu ĐƯỢC CUNG CẤP THẬT (video nếu có, ảnh đính kèm nếu có, thông tin sản phẩm, transcript/OCR nếu có).
Một số ảnh đính kèm là ẢNH CHỤP SỐ LIỆU TƯƠNG TÁC (lượt like / view / comment / share). Hãy ĐỌC các con số trong ảnh, đánh giá "social proof" và phản ánh vào nhận xét + điểm hook/độ tin cậy. Nếu thấy số liệu, ghi rõ vào "summary".

QUY TẮC BẰNG CHỨNG (BẮT BUỘC, chống bịa):
- Nếu CÓ video thật được gửi kèm: hãy XEM video, mô tả đúng những gì thấy, liệt kê "key_moments" KÈM MỐC THỜI GIAN dạng mm:ss. Đặt "video_seen"=true, "evidence_level"="video".
- Nếu KHÔNG có video thật (chỉ có link và/hoặc ảnh): TUYỆT ĐỐI KHÔNG mô tả cảnh quay như thể đã xem video. Đặt "video_seen"=false; "evidence_level"="images_only" nếu có ảnh, "text_only" nếu chỉ có link/chữ. Nói rõ trong "summary" rằng "chưa có video thật để phân tích, đây là đánh giá sơ bộ".
- "policy_visible_evidence": liệt kê dấu hiệu rủi ro chính sách NHÌN THẤY trực tiếp (vd "hình ảnh trước/sau", "logo thương hiệu", "lời hứa giảm cân nhanh"). Nếu không thấy gì trực tiếp → mảng rỗng.
KHÔNG bịa transcript/OCR/cảnh quay nếu không được cung cấp.
Nếu dữ liệu ít thì đặt "confidence" = "low" hoặc "medium".
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
    `Drive: ${input.driveWebUrl ?? "(không có)"}`,
    `Số ảnh đính kèm (ảnh số liệu tương tác / ảnh sản phẩm) — xem trong phần ảnh kèm theo: ${input.imageCount}`,
    input.videoProvided
      ? "VIDEO THẬT đã được đính kèm trong request — hãy XEM và phân tích trực tiếp, key_moments kèm mm:ss."
      : "KHÔNG có video thật trong request (chỉ link/ảnh) — đánh giá sơ bộ, KHÔNG mô tả cảnh như đã xem.",
    "",
    `Transcript: ${input.transcript ?? "(không có)"}`,
    `OCR: ${input.ocrText ?? "(không có)"}`,
    "",
    "Trả về JSON strict đúng schema sau:",
    JSON.stringify(
      {
        summary: "...",
        hook_3s: "...",
        visual_summary: "...",
        product_detected: "...",
        claims_detected: ["..."],
        pain_points: ["..."],
        audience_profile: {},
        key_moments: ["mm:ss - mô tả"],
        strong_scenes: ["..."],
        weak_scenes: ["..."],
        remake_angles: ["..."],
        video_seen: input.videoProvided,
        evidence_level: input.videoProvided ? "video" : "images_only|text_only",
        policy_visible_evidence: ["..."],
        confidence: "low|medium|high",
      },
      null,
      2,
    ),
  ];
  return lines.join("\n");
}
