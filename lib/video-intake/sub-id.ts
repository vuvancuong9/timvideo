/**
 * Sub ID = <ngày><tháng><account nhân viên><số thứ tự>, ví dụ:
 *   3105cuongbghvtc001   (ngày 31/05, account cuongbghvtc, STT 001)
 * Không có năm, không dấu gạch. Dùng làm mã định danh video + tên file.
 *
 * Phần hàm thuần (accountSlug/vnDateDDMM/buildSubId) an toàn cho client.
 * nextSubId nhận client làm tham số nên không import gì node-specific.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/** Account của nhân viên = phần trước @ của email (bỏ dấu, chỉ a-z0-9). */
export function accountSlug(
  email?: string | null,
  fullName?: string | null,
): string {
  const base =
    (email && email.includes("@") ? email.split("@")[0] : "") ||
    fullName ||
    "user";
  const slug = base
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // bỏ dấu tiếng Việt
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^a-zA-Z0-9]+/g, "")
    .toLowerCase();
  return slug || "user";
}

/** Ngày hiện tại theo giờ VN, dạng DDMM (vd 31/05 -> "3105"). */
export function vnDateDDMM(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("day")}${get("month")}`;
}

/** Ghép Sub ID: <DDMM><account><STT 3 chữ số>, vd "3105cuongbghvtc001". */
export function buildSubId(
  dateDDMM: string,
  account: string,
  seq: number,
): string {
  return `${dateDDMM}${account}${String(seq).padStart(3, "0")}`;
}

/**
 * Tính Sub ID kế tiếp cho 1 nhân viên trong NGÀY: đếm số submission của user
 * có sub_id bắt đầu bằng "<date>-<account>-" rồi +1.
 * (Lớp chống trùng cuối là unique index trên sub_id; người gọi nên retry khi 23505.)
 */
export async function nextSubId(
  client: SupabaseClient<Database>,
  userId: string,
  account: string,
  dateDDMM: string,
): Promise<string> {
  const prefix = `${dateDDMM}${account}`;
  const { count } = await client
    .from("video_submissions")
    .select("id", { count: "exact", head: true })
    .eq("created_by", userId)
    .like("sub_id", `${prefix}%`);
  return buildSubId(dateDDMM, account, (count ?? 0) + 1);
}
