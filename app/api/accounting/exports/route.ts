import { NextRequest, NextResponse } from "next/server";
import { requireApi } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fetchVideos } from "@/lib/videos";
import { toCsv, toXlsx } from "@/lib/export";
import {
  VIDEO_SOURCE_LABELS,
  VIDEO_STATUS_LABELS,
} from "@/lib/constants";
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
      const { rows: videos } = await fetchVideos(supabase, { limit: 1000 });
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
        "Link rút gọn",
        "Drive",
      ];
      rows = videos.map((v) => [
        v.created_at,
        v.creator?.full_name ?? v.creator?.email ?? "",
        v.shopee_product_url,
        v.product_price,
        v.commission_percent,
        v.estimated_commission ?? "",
        VIDEO_SOURCE_LABELS[v.video_source],
        v.category?.name ?? "",
        v.affiliate?.code ?? "",
        VIDEO_STATUS_LABELS[v.status],
        v.short_link ?? "",
        v.drive_web_url ?? "",
      ]);
      baseName = "video";
    }

    if (format === "xlsx") {
      const buffer = await toXlsx(type === "sales" ? "DoanhSo" : "Video", headers, rows);
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
