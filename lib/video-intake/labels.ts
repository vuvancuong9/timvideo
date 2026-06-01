import type {
  VideoSourceType,
  VideoSubmissionStatus,
} from "@/types/videoIntake";
import type {
  VideoFinalAction,
  RiskLevel,
  AnalysisConfidence,
} from "@/types/videoReview";

export const SOURCE_TYPE_LABELS: Record<VideoSourceType, string> = {
  tiktok_url: "TikTok",
  facebook_url: "Facebook",
  youtube_url: "YouTube",
  drive_upload: "Drive upload",
  other_url: "Khác",
};

export const SUBMISSION_STATUS_LABELS: Record<VideoSubmissionStatus, string> = {
  submitted: "Đã gửi",
  queued: "Chờ xử lý",
  processing: "Đang xử lý",
  reviewed: "Đã chấm",
  need_edit: "Cần sửa",
  approved: "Đã duyệt",
  rejected: "Từ chối",
  archived: "Lưu trữ",
};

export const FINAL_ACTION_LABELS: Record<VideoFinalAction, string> = {
  APPROVE_RUN_ADS: "Duyệt chạy ads",
  NEED_EDIT: "Cần chỉnh sửa",
  REMAKE_SAFE: "Nên làm lại cho an toàn",
  REJECT_POLICY_RISK: "Từ chối — rủi ro chính sách",
  REJECT_COPYRIGHT_RISK: "Từ chối — rủi ro bản quyền",
  LOW_PERFORMANCE: "Bán hàng kém",
};

/** Có nên lấy video này không — kết luận 1 dòng cực dễ hiểu cho nhân viên. */
export const FINAL_ACTION_VERDICT: Record<
  VideoFinalAction,
  { take: "yes" | "edit" | "no"; headline: string; detail: string }
> = {
  APPROVE_RUN_ADS: {
    take: "yes",
    headline: "✅ NÊN LẤY — video tốt, có thể chạy quảng cáo",
    detail:
      "Video bán hàng tốt và an toàn chính sách. Bạn có thể dùng để chạy ads (vẫn nên để admin duyệt lần cuối).",
  },
  NEED_EDIT: {
    take: "edit",
    headline: "⚠️ LẤY ĐƯỢC nhưng PHẢI SỬA trước khi chạy ads",
    detail:
      "Video có rủi ro vi phạm chính sách Facebook ở mức cao. Cần sửa theo phần “Đề xuất sửa” bên dưới rồi mới chạy ads.",
  },
  REMAKE_SAFE: {
    take: "edit",
    headline: "⚠️ NÊN LÀM LẠI bản an toàn hơn",
    detail:
      "Video có tiềm năng bán hàng nhưng nên quay/dựng lại theo gợi ý để an toàn và hiệu quả hơn.",
  },
  REJECT_POLICY_RISK: {
    take: "no",
    headline: "❌ KHÔNG NÊN LẤY — dễ vi phạm chính sách Facebook",
    detail:
      "Video có rủi ro cao vi phạm chính sách quảng cáo Facebook/Meta. Khả năng cao bị từ chối hoặc khóa quảng cáo. Nên bỏ qua hoặc làm lại hoàn toàn.",
  },
  REJECT_COPYRIGHT_RISK: {
    take: "no",
    headline: "❌ KHÔNG NÊN LẤY — dễ dính bản quyền",
    detail:
      "Video có dấu hiệu dùng lại nội dung/nhạc/logo/người nổi tiếng có bản quyền. Dễ bị báo cáo bản quyền. Nên bỏ qua.",
  },
  LOW_PERFORMANCE: {
    take: "no",
    headline: "❌ KHÔNG NÊN ƯU TIÊN — video bán hàng kém",
    detail:
      "Video an toàn nhưng khả năng bán hàng thấp (hook yếu, chưa rõ sản phẩm…). Không nên ưu tiên chạy ads.",
  },
};

/** Màu nền cho khối kết luận theo mức độ nên lấy. */
export const VERDICT_BG: Record<"yes" | "edit" | "no", string> = {
  yes: "border-green-300 bg-green-50 text-green-900",
  edit: "border-yellow-300 bg-yellow-50 text-yellow-900",
  no: "border-red-300 bg-red-50 text-red-900",
};

export const RISK_LABELS: Record<RiskLevel, string> = {
  low: "An toàn",
  medium: "Cần lưu ý",
  high: "Rủi ro cao",
  critical: "Rất nguy hiểm",
};

/** Nhãn 8 nhóm rủi ro chính sách bằng tiếng Việt dễ hiểu. */
export const POLICY_RISK_LABELS = {
  misleading_claim_risk: "Nói quá / gây hiểu lầm",
  health_claim_risk: "Hứa hẹn về sức khỏe / giảm cân",
  personal_attribute_risk: "Nhắm vào đặc điểm cá nhân",
  before_after_risk: "Hình ảnh trước / sau",
  shocking_content_risk: "Nội dung gây sốc / giật gân",
  adult_sensitive_risk: "Nội dung nhạy cảm / người lớn",
  ip_trademark_risk: "Bản quyền / logo / người nổi tiếng / nhạc",
  restricted_product_risk: "Sản phẩm bị hạn chế quảng cáo",
} as const;

/**
 * Đọc mức rủi ro của 1 nhóm: ưu tiên risk_scores (map động), fallback cột legacy
 * (row cũ trước migration 069), cuối cùng "low". Client-safe (không import server).
 */
export function readRiskLevel(
  riskScores: unknown,
  legacyRow: Record<string, unknown> | null | undefined,
  key: string,
): RiskLevel {
  const fromScores =
    riskScores && typeof riskScores === "object"
      ? (riskScores as Record<string, unknown>)[key]
      : undefined;
  const raw = fromScores ?? legacyRow?.[key];
  const s = String(raw ?? "").toLowerCase();
  return s === "low" || s === "medium" || s === "high" || s === "critical"
    ? (s as RiskLevel)
    : "low";
}

/** Nhãn điểm số dễ hiểu. */
export const SCORE_LABELS = {
  creative: "Điểm bán hàng",
  policy: "An toàn chính sách FB",
  copyright: "An toàn bản quyền",
  final: "Điểm tổng",
} as const;

/** Diễn giải 1 điểm số (0-100) thành chữ. */
export function scoreWord(score: number): { text: string; color: "green" | "yellow" | "red" } {
  if (score >= 75) return { text: "Tốt", color: "green" };
  if (score >= 50) return { text: "Tạm được", color: "yellow" };
  return { text: "Kém", color: "red" };
}

export const CONFIDENCE_LABELS: Record<AnalysisConfidence, string> = {
  low: "Thấp",
  medium: "Trung bình",
  high: "Cao",
};

/** Giải thích độ tin cậy cho nhân viên. */
export const CONFIDENCE_HINT: Record<AnalysisConfidence, string> = {
  low: "Độ tin cậy thấp — chỉ có link ngoài, chưa phân tích được nội dung video chi tiết. Muốn chính xác hơn hãy tải file video lên.",
  medium:
    "Độ tin cậy trung bình — nên tải file video lên Drive để chấm chính xác hơn.",
  high: "Độ tin cậy cao — đã phân tích được nội dung video.",
};

type BadgeColor = "gray" | "blue" | "green" | "yellow" | "red" | "purple";

export const RISK_COLORS: Record<RiskLevel, BadgeColor> = {
  low: "green",
  medium: "yellow",
  high: "red",
  critical: "red",
};

export const FINAL_ACTION_COLORS: Record<VideoFinalAction, BadgeColor> = {
  APPROVE_RUN_ADS: "green",
  NEED_EDIT: "yellow",
  REMAKE_SAFE: "blue",
  REJECT_POLICY_RISK: "red",
  REJECT_COPYRIGHT_RISK: "red",
  LOW_PERFORMANCE: "gray",
};

export const STATUS_COLORS: Record<VideoSubmissionStatus, BadgeColor> = {
  submitted: "blue",
  queued: "gray",
  processing: "yellow",
  reviewed: "purple",
  need_edit: "yellow",
  approved: "green",
  rejected: "red",
  archived: "gray",
};
