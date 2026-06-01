/**
 * Tạo submission + review job (server-only). Dùng RLS-bound client cho insert
 * submission (created_by = auth.uid()), và service role để tạo review job
 * (bảng job không cho user thường ghi).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { canonicalizeForDedup } from "@/lib/video-intake/duplicate";
import {
  accountSlug,
  vnDateDDMM,
  nextSubId,
} from "@/lib/video-intake/sub-id";
import { ApiError } from "@/lib/http";
import { writeAuditLog } from "@/lib/audit";
import { appendSubmissionRow } from "@/lib/sheets";
import { SOURCE_TYPE_LABELS } from "@/lib/video-intake/labels";
import type { Database } from "@/lib/database.types";
import type { CreateSubmissionInput } from "@/types/videoIntake";

export type CreateSubmissionResult = {
  submissionId: string;
  jobId: string;
};

/**
 * Tạo submission. URL luôn được canonicalize LẠI ở server (không tin client).
 * Trùng canonical_video_hash → 409. Sau insert → tạo review job queued.
 */
export async function createSubmissionWithJob(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: CreateSubmissionInput,
  actor?: { email?: string | null; fullName?: string | null },
): Promise<CreateSubmissionResult & { subId: string }> {
  const productName = (input.product_name ?? "").trim();
  if (!productName) throw new ApiError(400, "Thiếu tên sản phẩm");

  const shopeeUrl = (input.shopee_product_url ?? "").trim();
  if (!shopeeUrl) throw new ApiError(400, "Thiếu link sản phẩm Shopee");

  const price = Number(input.product_price);
  const pct = Number(input.commission_percent);
  if (!Number.isFinite(price) || price < 0) {
    throw new ApiError(400, "Giá sản phẩm không hợp lệ");
  }
  if (!Number.isFinite(pct) || pct < 0) {
    throw new ApiError(400, "% hoa hồng không hợp lệ");
  }

  const rawVideoUrl = (input.original_video_url ?? "").trim();
  // File video đã upload: Storage trả driveWebUrl (driveFileId=null); Drive cũ trả driveFileId.
  const hasUploadedVideo = Boolean(
    input.drive?.driveFileId || input.drive?.driveWebUrl,
  );
  const hasImages = (input.attachments ?? []).some((a) => a?.kind === "image");

  // Cần ÍT NHẤT link video gốc HOẶC file video/ảnh đã upload.
  if (!rawVideoUrl && !hasUploadedVideo && !hasImages) {
    throw new ApiError(400, "Cần link video gốc hoặc file đã tải lên");
  }

  // Canonicalize ở server (lớp chống trùng quyết định nằm ở DB unique index).
  let canonicalUrl: string | null = null;
  let canonicalHash: string | null = null;
  if (rawVideoUrl) {
    const c = canonicalizeForDedup(rawVideoUrl);
    canonicalUrl = c.canonicalUrl;
    canonicalHash = c.canonicalHash;
  }

  // Sub ID chính thức cấp ở server (không tin client). Dùng admin client để
  // đếm chính xác toàn bộ video của user (vượt RLS), tránh lệch số thứ tự.
  const admin = createSupabaseAdminClient();
  const account = accountSlug(actor?.email, actor?.fullName);
  const dateCompact = vnDateDDMM();

  function buildInsert(
    subId: string,
  ): Database["public"]["Tables"]["video_submissions"]["Insert"] {
    return {
      created_by: userId,
      sub_id: subId,
      product_name: productName,
      shopee_product_url: shopeeUrl,
      product_price: price,
      commission_percent: pct,
      category_id: input.category_id || null,
      source_type: input.source_type,
      original_video_url: rawVideoUrl || null,
      canonical_video_url: canonicalUrl,
      canonical_video_hash: canonicalHash,
      drive_file_id: input.drive?.driveFileId ?? null,
      drive_file_name: input.drive?.driveFileName ?? null,
      drive_web_url: input.drive?.driveWebUrl ?? null,
      drive_folder_id: input.drive?.driveFolderId ?? null,
      attachments: (input.attachments ??
        []) as Database["public"]["Tables"]["video_submissions"]["Insert"]["attachments"],
      staff_note: (input.staff_note ?? "").trim() || null,
      status: "queued",
    };
  }

  // Insert với retry khi sub_id đụng unique (2 video cùng lúc) — tối đa 5 lần.
  let sub: { id: string } | null = null;
  let subId = "";
  for (let attempt = 0; attempt < 5; attempt++) {
    subId = await nextSubId(admin, userId, account, dateCompact);
    const { data, error: insErr } = await supabase
      .from("video_submissions")
      .insert(buildInsert(subId))
      .select("id")
      .single();

    if (!insErr) {
      sub = data;
      break;
    }
    const code = (insErr as { code?: string; message?: string }).code;
    const msg = (insErr as { message?: string }).message ?? "";
    // trùng canonical video -> báo duplicate ngay (không retry)
    if (code === "23505" && msg.includes("canonical")) {
      throw new ApiError(409, "Video này đã tồn tại trong hệ thống", "DUPLICATE");
    }
    // trùng sub_id -> retry với số kế tiếp
    if (code === "23505") continue;
    throw insErr;
  }
  if (!sub) {
    throw new ApiError(409, "Không cấp được Sub ID, vui lòng thử lại", "SUBID_RACE");
  }

  // Tạo review job bằng service role (user thường không có quyền INSERT job).
  const { data: job, error: jobErr } = await admin
    .from("video_review_jobs")
    .insert({
      video_submission_id: sub.id,
      status: "queued",
      stage: "queued",
      raw_params: { source_type: input.source_type },
    })
    .select("id")
    .single();

  if (jobErr) {
    // rollback submission để không để lại submission mồ côi không có job
    await admin.from("video_submissions").delete().eq("id", sub.id);
    throw jobErr;
  }

  await writeAuditLog({
    actorId: userId,
    action: "submission.create",
    entityType: "video_submission",
    entityId: sub.id,
    after: { sub_id: subId, source_type: input.source_type, status: "queued" },
  });
  await writeAuditLog({
    actorId: userId,
    action: "review_job.create",
    entityType: "video_review_job",
    entityId: job.id,
    after: { video_submission_id: sub.id },
  });

  // Ghi 1 dòng vào Google Sheet (best-effort: lỗi không làm fail submit).
  try {
    let categoryName = "";
    if (input.category_id) {
      const { data: cat } = await admin
        .from("product_categories")
        .select("name")
        .eq("id", input.category_id)
        .maybeSingle();
      categoryName = cat?.name ?? "";
    }
    const fileUrl =
      input.drive?.driveWebUrl ??
      (input.attachments ?? []).find((a) => a?.kind === "video")?.web_url ??
      "";
    const r = await appendSubmissionRow({
      subId,
      productName,
      date: sheetDate(),
      employee: actor?.fullName || actor?.email || account,
      shopeeUrl,
      price,
      commissionPercent: pct,
      estimatedCommission: Math.round((price * pct) / 100) / 1, // = price*pct/100
      category: categoryName,
      source: SOURCE_TYPE_LABELS[input.source_type] ?? input.source_type,
      videoUrl: rawVideoUrl,
      fileUrl,
      status: "Chờ chấm",
    });
    await writeAuditLog({
      actorId: userId,
      action: r.ok ? "sheet.append_ok" : "sheet.append_failed",
      entityType: "video_submission",
      entityId: sub.id,
      after: { sub_id: subId, error: r.error ?? null },
    });
  } catch {
    // tuyệt đối không làm fail submit vì lỗi Sheet
  }

  return { submissionId: sub.id, jobId: job.id, subId };
}

/** Ngày dd/MM/yyyy theo giờ VN cho cột Sheet. */
function sheetDate(): string {
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date());
}
