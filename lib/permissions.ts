/**
 * Pure permission helpers — KHÔNG phụ thuộc DB hay request.
 * Đây là "nguồn sự thật" về phân quyền ở tầng ứng dụng, được dùng bởi cả
 * API route guard lẫn UI, và được test trực tiếp (tests/permissions.test.ts).
 *
 * Lưu ý: đây là lớp phân quyền phía server/app. Database còn 1 lớp RLS +
 * trigger độc lập (xem supabase/migrations) để chặn tận gốc.
 */
import type { UserRole, AppSection } from "@/lib/constants";

export function isReadOnly(role: UserRole): boolean {
  // Kế toán: tuyệt đối read-only.
  return role === "accountant";
}

/** Xem được TẤT CẢ video (của người khác) hay không. */
export function canViewAllVideos(role: UserRole): boolean {
  return role === "accountant" || role === "aggregator" || role === "admin";
}

/** Xem được một video cụ thể hay không (staff chỉ xem của chính mình). */
export function canViewVideo(
  role: UserRole,
  userId: string,
  video: { created_by: string },
): boolean {
  if (canViewAllVideos(role)) return true;
  return video.created_by === userId;
}

export function canCreateVideo(role: UserRole): boolean {
  return role === "staff" || role === "admin";
}

/** Sửa các trường lõi của video (giá, % HH, link gốc...). Chỉ admin. */
export function canEditVideoCore(role: UserRole): boolean {
  return role === "admin";
}

/** Phân video vào tài khoản affiliate. */
export function canAssignAffiliate(role: UserRole): boolean {
  return role === "aggregator" || role === "admin";
}

/** Điền/sửa link rút gọn. CHỈ admin (aggregator tuyệt đối không). */
export function canEditShortLink(role: UserRole): boolean {
  return role === "admin";
}

/** Sửa trạng thái tổng hợp + ghi chú tổng hợp + phân affiliate. */
export function canAggregate(role: UserRole): boolean {
  return role === "aggregator" || role === "admin";
}

export function canViewAllEmployees(role: UserRole): boolean {
  return role === "accountant" || role === "admin";
}

export function canViewAllSales(role: UserRole): boolean {
  return role === "accountant" || role === "admin";
}

/** Upload video lên Drive: staff/aggregator/admin được; accountant KHÔNG. */
export function canUploadDrive(role: UserRole): boolean {
  return role === "staff" || role === "aggregator" || role === "admin";
}

export function canManageUsers(role: UserRole): boolean {
  return role === "admin";
}

export function canManageCategories(role: UserRole): boolean {
  return role === "admin";
}

export function canManageAffiliateAccounts(role: UserRole): boolean {
  return role === "admin";
}

export function canViewAffiliateAccounts(role: UserRole): boolean {
  return role === "accountant" || role === "aggregator" || role === "admin";
}

export function canViewAuditLogs(role: UserRole): boolean {
  return role === "admin";
}

export function canImportSales(role: UserRole): boolean {
  return role === "admin";
}

export function canExport(role: UserRole): boolean {
  return role === "accountant" || role === "admin";
}

/** Truy cập khu vực (section) nào. Admin vào được tất cả. */
export function canAccessSection(role: UserRole, section: AppSection): boolean {
  if (role === "admin") return true;
  switch (section) {
    case "staff":
      return role === "staff";
    case "accounting":
      return role === "accountant";
    case "aggregate":
      return role === "aggregator";
    case "admin":
      return false;
  }
}

/**
 * Whitelist trường được phép cập nhật trên video_submissions theo role,
 * dùng bởi PATCH /api/videos/:id. "ALL" = admin toàn quyền.
 */
export function allowedVideoUpdateFields(role: UserRole): "ALL" | string[] {
  if (role === "admin") return "ALL";
  if (role === "aggregator") {
    return ["assigned_affiliate_account_id", "status", "aggregate_note"];
  }
  // staff & accountant: không được sửa trực tiếp qua PATCH chung.
  return [];
}

export function canUpdateVideoFields(role: UserRole, fields: string[]): boolean {
  const allowed = allowedVideoUpdateFields(role);
  if (allowed === "ALL") return true;
  if (allowed.length === 0) return false;
  return fields.length > 0 && fields.every((f) => allowed.includes(f));
}
