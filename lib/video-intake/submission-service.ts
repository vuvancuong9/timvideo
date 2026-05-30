/**
 * Tạo submission + review job (server-only). Dùng RLS-bound client cho insert
 * submission (created_by = auth.uid()), và service role để tạo review job
 * (bảng job không cho user thường ghi).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { canonicalizeForDedup } from "@/lib/video-intake/duplicate";
import { ApiError } from "@/lib/http";
import { writeAuditLog } from "@/lib/audit";
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
): Promise<CreateSubmissionResult> {
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

  const isDrive = input.source_type === "drive_upload";
  const rawVideoUrl = (input.original_video_url ?? "").trim();

  if (!isDrive && !rawVideoUrl) {
    throw new ApiError(400, "Thiếu link video gốc");
  }
  if (isDrive && !input.drive?.driveFileId) {
    throw new ApiError(400, "Thiếu file Drive đã upload");
  }

  // Canonicalize ở server (lớp chống trùng quyết định nằm ở DB unique index).
  let canonicalUrl: string | null = null;
  let canonicalHash: string | null = null;
  if (rawVideoUrl) {
    const c = canonicalizeForDedup(rawVideoUrl);
    canonicalUrl = c.canonicalUrl;
    canonicalHash = c.canonicalHash;
  }

  const insertRow: Database["public"]["Tables"]["video_submissions"]["Insert"] =
    {
      created_by: userId,
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
      staff_note: (input.staff_note ?? "").trim() || null,
      status: "queued",
    };

  const { data: sub, error: insErr } = await supabase
    .from("video_submissions")
    .insert(insertRow)
    .select("id")
    .single();

  if (insErr) {
    if ((insErr as { code?: string }).code === "23505") {
      throw new ApiError(
        409,
        "Video này đã tồn tại trong hệ thống",
        "DUPLICATE",
      );
    }
    throw insErr;
  }

  // Tạo review job bằng service role (user thường không có quyền INSERT job).
  const admin = createSupabaseAdminClient();
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
    after: { source_type: input.source_type, status: "queued" },
  });
  await writeAuditLog({
    actorId: userId,
    action: "review_job.create",
    entityType: "video_review_job",
    entityId: job.id,
    after: { video_submission_id: sub.id },
  });

  return { submissionId: sub.id, jobId: job.id };
}
