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
};

export const CONTENT_ANALYSIS_SYSTEM_PROMPT = `Bạn là chuyên gia phân tích video sản phẩm để bán affiliate.
Phân tích video dựa trên dữ liệu được cung cấp (thông tin sản phẩm, frames nếu có, transcript nếu có, OCR nếu có, ẢNH đính kèm nếu có).
Một số ảnh đính kèm là ẢNH CHỤP SỐ LIỆU TƯƠNG TÁC (lượt like / view / comment / share). Hãy ĐỌC các con số trong ảnh, đánh giá độ hấp dẫn & "social proof" (video càng nhiều tương tác càng tiềm năng), và phản ánh vào nhận xét + điểm hook/độ tin cậy. Nếu thấy số liệu tương tác, ghi rõ vào "summary" (vd: "video gốc đạt ~120k view, 3k like").
KHÔNG bịa transcript/OCR nếu không được cung cấp.
Nếu dữ liệu ít (chỉ link ngoài, không có frame/transcript/ảnh) thì đặt "confidence" = "low" hoặc "medium".
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
    `Số frame trích xuất được: ${input.frameCount}`,
    `Số ảnh đính kèm (ảnh số liệu tương tác / ảnh sản phẩm) — xem trong phần ảnh kèm theo: ${input.imageCount}`,
    `Có file video: ${input.hasVideoFile ? "CÓ" : "KHÔNG (confidence thấp hơn)"}`,
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
        key_moments: ["..."],
        strong_scenes: ["..."],
        weak_scenes: ["..."],
        remake_angles: ["..."],
        confidence: "low|medium|high",
      },
      null,
      2,
    ),
  ];
  return lines.join("\n");
}
