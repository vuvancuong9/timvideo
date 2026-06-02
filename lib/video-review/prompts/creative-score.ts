/** Prompt chấm điểm REVIEW/LAN TỎA của video (strict JSON). */

export type CreativePromptInput = {
  productCategory: string | null;
  shopeeProductUrl: string;
  productPrice: number;
  commissionPercent: number;
  summary: string | null;
  hook3s: string | null;
  visualSummary: string | null;
  transcript: string | null;
  hasVideoFile: boolean;
  /** Bối cảnh từ Gemini analyze để chấm đúng review/viral. */
  evidenceLevel: "video" | "frames" | "images_only" | "text_only";
  videoType: string;
  isRealReview: boolean;
};

export const CREATIVE_SCORE_SYSTEM_PROMPT = `Bạn là chuyên gia đánh giá video REVIEW/CHIA SẺ sản phẩm cho mục tiêu lan tỏa, giữ chân người xem và có thể chạy affiliate ads.

Chấm điểm 0-100 cho các tiêu chí:
- review_depth_score: độ sâu review — có trải nghiệm/test/cảm nhận thật không?
- product_demo_score: có demo/swatch/test/mở hộp/sử dụng thực tế không?
- authenticity_score: có giống người dùng thật chia sẻ, đáng tin không?
- viral_hook_score: 1-3 giây đầu có kéo người xem không?
- retention_score: có tiến trình/cắt cảnh/payoff khiến xem tiếp không?
- shareability_score: người xem có lý do lưu/share/comment không?
- sales_conversion_score: có khiến người xem muốn mua không?
- production_quality_score: hình ảnh/âm thanh/bố cục có đủ rõ không?

QUY TẮC CỨNG:
1. Video chỉ cầm sản phẩm + hiện giá sale mà KHÔNG demo/test/cảm nhận → review_depth_score < 40.
2. Video "sales_deal" KHÔNG được chấm review cao.
3. Nếu evidence_level != "video" → "confidence" KHÔNG được "high".
4. Thiếu bằng chứng sử dụng thật → trừ mạnh review_depth_score, product_demo_score, authenticity_score.
5. CHỈ trả JSON hợp lệ, không thêm chữ ngoài JSON.`;

export function buildCreativeScoreUserPrompt(
  input: CreativePromptInput,
): string {
  const lines = [
    `Danh mục: ${input.productCategory ?? "(không rõ)"}`,
    `Link Shopee: ${input.shopeeProductUrl}`,
    `Giá: ${input.productPrice} | % hoa hồng: ${input.commissionPercent}`,
    `Bằng chứng (evidence_level): ${input.evidenceLevel}`,
    `Loại video (AI phân loại): ${input.videoType} | is_real_review: ${input.isRealReview}`,
    "",
    `Summary: ${input.summary ?? "(không có)"}`,
    `Hook 3s: ${input.hook3s ?? "(không có)"}`,
    `Visual summary: ${input.visualSummary ?? "(không có)"}`,
    `Transcript: ${input.transcript ?? "(không có)"}`,
    "",
    "Trả về JSON strict đúng schema sau (điểm 0-100):",
    JSON.stringify(
      {
        review_depth_score: 0,
        product_demo_score: 0,
        authenticity_score: 0,
        viral_hook_score: 0,
        retention_score: 0,
        shareability_score: 0,
        sales_conversion_score: 0,
        production_quality_score: 0,
        reasons: ["..."],
        suggested_titles: ["..."],
        suggested_scripts: ["..."],
        suggested_edits: ["..."],
        confidence: "low|medium|high",
      },
      null,
      2,
    ),
  ];
  return lines.join("\n");
}
