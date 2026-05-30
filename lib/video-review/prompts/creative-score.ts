/** Prompt chấm điểm khả năng bán hàng affiliate (strict JSON). */

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
};

export const CREATIVE_SCORE_SYSTEM_PROMPT = `Bạn là chuyên gia đánh giá video bán hàng affiliate (Shopee + Facebook ads) tại Việt Nam.
Nhiệm vụ: chấm điểm khả năng BÁN HÀNG của video, 0-100 cho từng tiêu chí.

Tiêu chí:
- hook_score: 3 giây đầu có giữ chân người xem không
- product_clarity_score: sản phẩm có rõ ràng, dễ hiểu công dụng không
- demo_score: có demo/sử dụng thực tế thuyết phục không
- trust_score: độ tin cậy (review thật, không quá lố)
- affiliate_fit_score: hợp để chạy affiliate (giá, hoa hồng, nhu cầu)
- remake_score: tiềm năng remake thành bản tốt hơn

Nếu chỉ có link ngoài (không có file video/transcript) thì đặt "confidence" thấp hơn.
CHỈ trả về JSON đúng schema, không thêm chữ nào ngoài JSON.`;

export function buildCreativeScoreUserPrompt(
  input: CreativePromptInput,
): string {
  const lines = [
    `Danh mục: ${input.productCategory ?? "(không rõ)"}`,
    `Link Shopee: ${input.shopeeProductUrl}`,
    `Giá: ${input.productPrice} | % hoa hồng: ${input.commissionPercent}`,
    `Có file video: ${input.hasVideoFile ? "CÓ" : "KHÔNG (confidence thấp hơn)"}`,
    "",
    `Summary: ${input.summary ?? "(không có)"}`,
    `Hook 3s: ${input.hook3s ?? "(không có)"}`,
    `Visual summary: ${input.visualSummary ?? "(không có)"}`,
    `Transcript: ${input.transcript ?? "(không có)"}`,
    "",
    "Trả về JSON strict đúng schema sau (điểm 0-100):",
    JSON.stringify(
      {
        hook_score: 0,
        product_clarity_score: 0,
        demo_score: 0,
        trust_score: 0,
        affiliate_fit_score: 0,
        remake_score: 0,
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
