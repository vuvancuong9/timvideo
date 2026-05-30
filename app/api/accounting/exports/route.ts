import { NextRequest, NextResponse } from "next/server";
import { requireApi } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  fetchSubmissions,
  fetchLatestDecisionsMap,
} from "@/lib/video-intake/queries";
import { toCsv, toXlsx } from "@/lib/export";
import {
  SOURCE_TYPE_LABELS,
  SUBMISSION_STATUS_LABELS,
  FINAL_ACTION_LABELS,
} from "@/lib/video-intake/labels";
import { handleApiError } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Row = Array<string | number | null | undefined>;

// GET /api/accounting/exports?type=videos|sales&format=csv|xlsx
export async function GET(req: NextRequest) {
  try {
    const guard = await requireApi(["accountant", "admin"]);
    if (guard instanceof NextResponse) return guard;

    const sp = req.nextUrl.searchParams;
    const type = sp.get("type") === "sales" ? "sales" : "videos";
    const format = sp.get("format") === "xlsx" ? "xlsx" : "csv";
    const supabase = await createSupabaseServerClient();

    let headers: string[];
    let rows: Row[];
    let baseName: string;

    if (type === "sales") {
      let query = supabase
        .from("sales_records")
        .select(
          "*, employee:profiles!sales_records_employee_id_fkey(full_name,email)",
        )
        .order("date", { ascending: false });
      const from = sp.get("from");
      const to = sp.get("to");
      if (from) query = query.gte("date", from);
      if (to) query = query.lte("date", to);
      const { data, error } = await query;
      if (error) throw error;
      type SalesRow = {
        date: string;
        employee: { full_name: string | null; email: string } | null;
        clicks: number;
        orders: number;
        revenue: number;
        commission: number;
        source: string | null;
      };
      const sales = (data ?? []) as unknown as SalesRow[];
      headers = [
        "Ngày",
        "Nhân viên",
        "Email",
        "Clicks",
        "Orders",
        "Doanh thu",
        "Hoa hồng",
        "Nguồn",
      ];
      rows = sales.map((s) => [
        s.date,
        s.employee?.full_name ?? "",
        s.employee?.email ?? "",
        s.clicks,
        s.orders,
        s.revenue,
        s.commission,
        s.source ?? "",
      ]);
      baseName = "doanh-so";
    } else {
      const { rows: subs } = await fetchSubmissions(supabase, { limit: 1000 });
      const decisions = await fetchLatestDecisionsMap(
        supabase,
        subs.map((s) => s.id),
      );
      headers = [
        "Ngày tạo",
        "Nhân viên",
        "Link sản phẩm",
        "Giá",
        "% HH",
        "HH dự kiến",
        "Nguồn",
        "Danh mục",
        "Affiliate",
        "Trạng thái",
        "Creative",
        "Policy safety",
        "Final action",
        "Link rút gọn",
        "Drive",
      ];
      rows = subs.map((v) => {
        const d = decisions.get(v.id);
        return [
          v.created_at,
          v.creator?.full_name ?? v.creator?.email ?? "",
          v.shopee_product_url,
          v.product_price,
          v.commission_percent,
          v.estimated_commission ?? "",
          SOURCE_TYPE_LABELS[v.source_type],
          v.category?.name ?? "",
          v.affiliate?.code ?? "",
          SUBMISSION_STATUS_LABELS[v.status],
          d?.creative_score ?? "",
          d?.policy_safety_score ?? "",
          d ? FINAL_ACTION_LABELS[d.final_action] : "",
          v.short_link ?? "",
          v.drive_web_url ?? "",
        ];
      });
      baseName = "video";
    }

    if (format === "xlsx") {
      const buffer = await toXlsx(
        type === "sales" ? "DoanhSo" : "Video",
        headers,
        rows,
      );
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${baseName}.xlsx"`,
        },
      });
    }

    const csv = toCsv(headers, rows);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${baseName}.csv"`,
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
