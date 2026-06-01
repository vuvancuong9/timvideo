/** Prompt chấm rủi ro chính sách quảng cáo Facebook/Meta (strict JSON). */
import type { PolicyRiskGroup } from "@/lib/video-review/policy-groups-config";

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

/**
 * System prompt — danh sách nhóm rủi ro render ĐỘNG từ cấu hình admin
 * (lib/video-review/policy-groups-config.ts). Phần nguyên tắc giữ nguyên.
 */
export function buildFacebookPolicySystemPrompt(
  groups: PolicyRiskGroup[],
): string {
  const groupLines = groups
    .map((g) => `- ${g.key}: ${g.description_vi || g.label_vi}`)
    .join("\n");
  return `Bạn là reviewer RỦI RO quảng cáo Facebook/Meta cho video affiliate Shopee tại Việt Nam.

NGUYÊN TẮC BẮT BUỘC:
- Bạn KHÔNG phải Meta và KHÔNG được kết luận chắc chắn video sẽ bị từ chối hay được duyệt.
- Nhiệm vụ của bạn là PHÁT HIỆN RỦI RO chính sách và ĐỀ XUẤT cách sửa.
- Chỉ dùng ngôn ngữ "rủi ro", không dùng "chắc chắn vi phạm".
- Nếu dữ liệu đầu vào ít (chỉ có link ngoài, không có file video/transcript/OCR), hãy đặt "confidence" = "low" hoặc "medium" và KHÔNG khẳng định mạnh.

Bạn phân tích các nhóm rủi ro sau (mỗi nhóm cho mức low|medium|high|critical):
${groupLines}

Chấm 2 điểm an toàn 0-100 (cao = an toàn):
- policy_safety_score: càng nhiều claim quá đà / before-after / sức khỏe / gây sốc thì càng THẤP.
- copyright_safety_score: càng nhiều dấu hiệu dùng lại logo/người nổi tiếng/nhạc/bản quyền thì càng THẤP.

final_policy_level = mức rủi ro tổng hợp cao nhất đáng lưu ý.

CHỈ trả về JSON đúng schema, không thêm chữ nào ngoài JSON.`;
}

export function buildFacebookPolicyUserPrompt(
  input: PolicyPromptInput,
  groups: PolicyRiskGroup[],
): string {
  // Schema ví dụ: các khóa nhóm rủi ro sinh động + các field cố định.
  const riskSchema = Object.fromEntries(
    groups.map((g) => [g.key, "low|medium|high|critical"]),
  );
  const schema = {
    policy_safety_score: 0,
    copyright_safety_score: 0,
    ...riskSchema,
    risk_reasons: ["..."],
    policy_references: ["..."],
    suggested_fixes: ["..."],
    final_policy_level: "low|medium|high|critical",
    confidence: "low|medium|high",
  };

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
    JSON.stringify(schema, null, 2),
  ];
  return lines.join("\n");
}
