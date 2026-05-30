/**
 * Role guard + field-level permission cho module video-intake/review.
 * Xây trên lib/auth/session.ts. Server-side enforcement (KHÔNG chỉ ẩn UI).
 */
import { NextResponse } from "next/server";
import {
  getOptionalSession,
  type SessionContext,
} from "@/lib/auth/session";
import { ApiError } from "@/lib/http";
import type { UserRole } from "@/lib/constants";
import type { VideoSubmissionRow } from "@/types/videoIntake";

export type CurrentUser = SessionContext;

/** Lấy profile user hiện tại (null nếu chưa đăng nhập / bị khóa). */
export async function getCurrentUserProfile(): Promise<CurrentUser | null> {
  return getOptionalSession();
}

/**
 * Bắt buộc đăng nhập + role hợp lệ cho API route.
 * Trả về SessionContext, hoặc NextResponse lỗi (401/403) để route return luôn.
 * admin luôn vượt qua.
 */
export async function requireRole(
  allowedRoles: UserRole[],
): Promise<CurrentUser | NextResponse> {
  const user = await getCurrentUserProfile();
  if (!user) {
    return NextResponse.json(
      { error: "Chưa đăng nhập", code: "UNAUTHENTICATED" },
      { status: 401 },
    );
  }
  if (user.role !== "admin" && !allowedRoles.includes(user.role)) {
    return NextResponse.json(
      { error: "Bạn không có quyền thực hiện thao tác này", code: "FORBIDDEN" },
      { status: 403 },
    );
  }
  return user;
}

/** Xem được 1 submission không. staff chỉ xem của chính mình. */
export function canViewSubmission(
  user: CurrentUser,
  submission: Pick<VideoSubmissionRow, "created_by">,
): boolean {
  if (
    user.role === "accountant" ||
    user.role === "aggregator" ||
    user.role === "admin"
  ) {
    return true;
  }
  return submission.created_by === user.userId;
}

/** Các field aggregator được sửa. */
const AGGREGATOR_FIELDS = new Set([
  "assigned_affiliate_account_id",
  "aggregate_note",
  "status",
]);

/** Các field staff (creator) được sửa khi video chưa reviewed. */
const STAFF_CREATOR_FIELDS = new Set([
  "shopee_product_url",
  "product_price",
  "commission_percent",
  "category_id",
  "original_video_url",
  "staff_note",
]);

/** Field-level: user có được sửa field này không. */
export function canUpdateSubmissionField(
  user: CurrentUser,
  field: string,
  ctx?: { isCreator?: boolean; isReviewed?: boolean },
): boolean {
  // accountant: read-only tuyệt đối
  if (user.role === "accountant") return false;

  // admin: toàn quyền
  if (user.role === "admin") return true;

  // short_link & admin_note: chỉ admin (đã return ở trên)
  if (field === "short_link" || field === "admin_note") return false;

  if (user.role === "aggregator") {
    return AGGREGATOR_FIELDS.has(field);
  }

  if (user.role === "staff") {
    if (!ctx?.isCreator) return false;
    if (ctx?.isReviewed) return false; // sau khi reviewed staff không sửa nữa
    return STAFF_CREATOR_FIELDS.has(field);
  }

  return false;
}

/**
 * Kiểm tra toàn bộ patch hợp lệ. Ném ApiError(403) nếu có field không được phép.
 */
export function assertCanUpdateSubmissionPatch(
  user: CurrentUser,
  patch: Record<string, unknown>,
  ctx?: { isCreator?: boolean; isReviewed?: boolean },
): void {
  const fields = Object.keys(patch);
  if (fields.length === 0) {
    throw new ApiError(400, "Không có trường nào để cập nhật");
  }
  const forbidden = fields.filter(
    (f) => !canUpdateSubmissionField(user, f, ctx),
  );
  if (forbidden.length > 0) {
    throw new ApiError(
      403,
      `Bạn không được phép sửa: ${forbidden.join(", ")}`,
      "FIELD_FORBIDDEN",
    );
  }
}
