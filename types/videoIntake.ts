import type { Database, Tables } from "@/lib/database.types";

export type VideoSourceType = Database["public"]["Enums"]["video_source_type"];
export type VideoSubmissionStatus =
  Database["public"]["Enums"]["video_submission_status"];

export type VideoSubmissionRow = Tables<"video_submissions">;
export type ProductCategoryRow = Tables<"product_categories">;
export type AffiliateAccountRow = Tables<"affiliate_accounts">;

/** File đính kèm: video phụ hoặc ảnh (vd ảnh chụp lượt like/view/comment). */
export type SubmissionAttachment = {
  drive_file_id: string;
  name: string | null;
  web_url: string | null;
  mime_type: string | null;
  kind: "video" | "image";
};

/** Input nhân viên gửi lên khi tạo submission. */
export type CreateSubmissionInput = {
  shopee_product_url: string;
  product_price: number;
  commission_percent: number;
  category_id?: string | null;
  /** Sub ID dự kiến từ client (tên file dùng theo). Server vẫn tự cấp chính thức. */
  sub_id?: string | null;
  source_type: VideoSourceType;
  original_video_url?: string | null;
  staff_note?: string | null;
  drive?: {
    driveFileId?: string | null;
    driveFileName?: string | null;
    driveWebUrl?: string | null;
    driveFolderId?: string | null;
  } | null;
  /** Nhiều file đính kèm (video phụ + ảnh số liệu tương tác). */
  attachments?: SubmissionAttachment[] | null;
};

export type DuplicateExisting = {
  id: string;
  created_by_name: string | null;
  created_at: string;
  status: string;
};

export type DuplicateCheckResult = {
  ok: true;
  duplicate: boolean;
  existing?: DuplicateExisting;
  canonical_video_url: string;
  canonical_video_hash: string;
  source_type: VideoSourceType;
};
