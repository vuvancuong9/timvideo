import type { Database } from "@/lib/database.types";

export type UserRole = Database["public"]["Enums"]["user_role"];
export type VideoSource = Database["public"]["Enums"]["video_source"];
export type VideoStatus = Database["public"]["Enums"]["video_status"];

export const ROLES: UserRole[] = ["staff", "accountant", "aggregator", "admin"];

export const ROLE_LABELS: Record<UserRole, string> = {
  staff: "Nhân viên",
  accountant: "Kế toán",
  aggregator: "Tổng hợp",
  admin: "Quản trị viên",
};

/** Trang mặc định sau khi đăng nhập theo từng role. */
export const ROLE_HOME: Record<UserRole, string> = {
  staff: "/staff/new-video",
  accountant: "/accounting/dashboard",
  aggregator: "/aggregate/dashboard",
  admin: "/admin/dashboard",
};

export const VIDEO_SOURCE_LABELS: Record<VideoSource, string> = {
  facebook: "Facebook",
  tiktok: "TikTok",
  youtube: "YouTube",
  other: "Khác",
};

export const VIDEO_STATUS_LABELS: Record<VideoStatus, string> = {
  draft: "Nháp",
  submitted: "Đã gửi",
  assigned: "Đã phân affiliate",
  short_linked: "Đã gắn link rút gọn",
  rejected: "Từ chối",
  archived: "Lưu trữ",
};

export type AppSection = "staff" | "accounting" | "aggregate" | "admin";

export type NavItem = { href: string; label: string };
export type NavSection = { title: string; items: NavItem[] };

/** Menu sidebar theo từng role (admin gộp toàn bộ). */
export const NAV_BY_ROLE: Record<UserRole, NavSection[]> = {
  staff: [
    {
      title: "Nhân viên",
      items: [
        { href: "/staff/new-video", label: "Nhập video mới" },
        { href: "/staff/my-videos", label: "Video của tôi" },
        { href: "/staff/my-sales", label: "Doanh số của tôi" },
      ],
    },
  ],
  accountant: [
    {
      title: "Kế toán",
      items: [
        { href: "/accounting/dashboard", label: "Tổng quan" },
        { href: "/accounting/employees", label: "Nhân viên" },
        { href: "/accounting/videos", label: "Video / Link" },
        { href: "/accounting/sales", label: "Doanh số" },
        { href: "/accounting/exports", label: "Xuất dữ liệu" },
      ],
    },
  ],
  aggregator: [
    {
      title: "Tổng hợp",
      items: [
        { href: "/aggregate/dashboard", label: "Tổng quan" },
        { href: "/aggregate/videos", label: "Tất cả video" },
        { href: "/aggregate/assign", label: "Phân affiliate" },
        { href: "/aggregate/affiliate-accounts", label: "Tài khoản affiliate" },
      ],
    },
  ],
  admin: [
    {
      title: "Quản trị",
      items: [
        { href: "/admin/dashboard", label: "Tổng quan" },
        { href: "/admin/videos", label: "Tất cả video" },
        { href: "/admin/short-links", label: "Link rút gọn" },
        { href: "/admin/users", label: "Người dùng & quyền" },
        { href: "/admin/categories", label: "Danh mục" },
        { href: "/admin/affiliate-accounts", label: "Tài khoản affiliate" },
        { href: "/admin/audit-logs", label: "Audit log" },
        { href: "/admin/settings", label: "Cấu hình" },
      ],
    },
  ],
};
