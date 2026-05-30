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
  REMAKE_SAFE: "Remake an toàn",
  REJECT_POLICY_RISK: "Từ chối — rủi ro chính sách",
  REJECT_COPYRIGHT_RISK: "Từ chối — rủi ro bản quyền",
  LOW_PERFORMANCE: "Hiệu suất thấp",
};

export const RISK_LABELS: Record<RiskLevel, string> = {
  low: "Thấp",
  medium: "Trung bình",
  high: "Cao",
  critical: "Nghiêm trọng",
};

export const CONFIDENCE_LABELS: Record<AnalysisConfidence, string> = {
  low: "Thấp",
  medium: "Trung bình",
  high: "Cao",
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
