import { NextRequest, NextResponse } from "next/server";
import { requireApi } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { writeAuditLog } from "@/lib/audit";
import { ApiError, handleApiError, jsonOk, readJson } from "@/lib/http";

export const dynamic = "force-dynamic";

type ImportRow = {
  employee_id?: string;
  video_submission_id?: string | null;
  date?: string;
  clicks?: number;
  orders?: number;
  revenue?: number;
  commission?: number;
  source?: string | null;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// POST /api/admin/sales/import — admin nhập doanh số hàng loạt.
export async function POST(req: NextRequest) {
  try {
    const guard = await requireApi(["admin"]);
    if (guard instanceof NextResponse) return guard;
    const session = guard;

    const body = await readJson<{ records?: ImportRow[] }>(req);
    const records = body.records;
    if (!Array.isArray(records) || records.length === 0) {
      throw new ApiError(400, "Không có dữ liệu doanh số để nhập");
    }

    const rows = records.map((r, i) => {
      if (!r.employee_id) {
        throw new ApiError(400, `Dòng ${i + 1}: thiếu employee_id`);
      }
      if (!r.date || !DATE_RE.test(r.date)) {
        throw new ApiError(400, `Dòng ${i + 1}: ngày không hợp lệ (YYYY-MM-DD)`);
      }
      return {
        employee_id: r.employee_id,
        video_submission_id: r.video_submission_id ?? null,
        date: r.date,
        clicks: Number(r.clicks ?? 0),
        orders: Number(r.orders ?? 0),
        revenue: Number(r.revenue ?? 0),
        commission: Number(r.commission ?? 0),
        source: r.source ?? null,
      };
    });

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("sales_records")
      .insert(rows)
      .select("id");
    if (error) throw error;

    await writeAuditLog({
      actorId: session.userId,
      action: "sales.import",
      entityType: "sales_record",
      after: { count: data?.length ?? 0 },
    });

    return jsonOk({ inserted: data?.length ?? 0 }, { status: 201 });
  } catch (e) {
    return handleApiError(e);
  }
}
