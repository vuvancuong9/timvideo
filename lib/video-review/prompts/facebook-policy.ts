/** Prompt chấm rủi ro chính sách quảng cáo Facebook/Meta (strict JSON). */

export type PolicyPromptInput = {
  productCategory: string | null;
  shopeeProductUrl: string;
  visualSummary: string | null;
  transcript: string | null;
  ocrText: string | null;
  claimsDetected: string[];
  metadataNote: string;
  hasVideoFile: boolean;
};

export const FACEBOOK_POLICY_SYSTEM_PROMPT = `Bạn là reviewer RỦI RO quảng cáo Facebook/Meta cho video affiliate Shopee tại Việt Nam.

NGUYÊN TẮC BẮT BUỘC:
- Bạn KHÔNG phải Meta và KHÔNG được kết luận chắc chắn video sẽ bị từ chối hay được duyệt.
- Nhiệm vụ của bạn là PHÁT HIỆN RỦI RO chính sách và ĐỀ XUẤT cách sửa.
- Chỉ dùng ngôn ngữ "rủi ro", không dùng "chắc chắn vi phạm".
- Nếu dữ liệu đầu vào ít (chỉ có link ngoài, không có file video/transcript/OCR), hãy đặt "confidence" = "low" hoặc "medium" và KHÔNG khẳng định mạnh.

Bạn phân tích các nhóm rủi ro sau (mỗi nhóm cho mức low|medium|high|critical):
- misleading_claim_risk: tuyên bố sai/gây hiểu lầm, hứa hẹn quá đà
- health_claim_risk: tuyên bố sức khỏe/giảm cân/chữa bệnh/cơ thể
- personal_attribute_risk: nhắm thuộc tính cá nhân (giới tính, tôn giáo, sức khỏe...)
- before_after_risk: hình ảnh trước/sau
- shocking_content_risk: nội dung gây sốc/giật gân
- adult_sensitive_risk: nội dung người lớn/nhạy cảm
- ip_trademark_risk: bản quyền/thương hiệu/logo/người nổi tiếng/nhạc bản quyền
- restricted_product_risk: sản phẩm bị hạn chế

Chấm 2 điểm an toàn 0-100 (cao = an toàn):
- policy_safety_score: càng nhiều claim quá đà / before-after / sức khỏe / gây sốc thì càng THẤP.
- copyright_safety_score: càng nhiều dấu hiệu dùng lại logo/người nổi tiếng/nhạc/bản quyền thì càng THẤP.

final_policy_level = mức rủi ro tổng hợp cao nhất đáng lưu ý.

CHỈ trả về JSON đúng schema, không thêm chữ nào ngoài JSON.`;

export function buildFacebookPolicyUserPrompt(input: PolicyPromptInput): string {
  const lines = [
    `Danh mục sản phẩm: ${input.productCategory ?? "(không rõ)"}`,
    `Link sản phẩm Shopee: ${input.shopeeProductUrl}`,
    `Có file video để phân tích trực tiếp: ${input.hasVideoFile ? "CÓ" : "KHÔNG (chỉ có link ngoài → confidence phải thấp hơn)"}`,
    "",
    "Visual summary:",
    input.visualSummary ?? "(không có)",
    "",
    "Transcript:",
    input.transcript ?? "(không có)",
    "",
    "OCR text trên video:",
    input.ocrText ?? "(không có)",
    "",
    "Claims phát hiện:",
    input.claimsDetected.length
      ? input.claimsDetected.map((c) => `- ${c}`).join("\n")
      : "(không có)",
    "",
    `Ghi chú metadata: ${input.metadataNote}`,
    "",
    "Trả về JSON strict đúng schema sau:",
    JSON.stringify(
      {
        policy_safety_score: 0,
        copyright_safety_score: 0,
        misleading_claim_risk: "low|medium|high|critical",
        health_claim_risk: "low|medium|high|critical",
        personal_attribute_risk: "low|medium|high|critical",
        before_after_risk: "low|medium|high|critical",
        shocking_content_risk: "low|medium|high|critical",
        adult_sensitive_risk: "low|medium|high|critical",
        ip_trademark_risk: "low|medium|high|critical",
        restricted_product_risk: "low|medium|high|critical",
        risk_reasons: ["..."],
        policy_references: ["..."],
        suggested_fixes: ["..."],
        final_policy_level: "low|medium|high|critical",
        confidence: "low|medium|high",
      },
      null,
      2,
    ),
  ];
  return lines.join("\n");
}
