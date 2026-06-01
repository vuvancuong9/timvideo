import { NextRequest, NextResponse } from "next/server";
import { requireApi } from "@/lib/auth/session";
import { exchangeAndStore } from "@/lib/drive-oauth";
import { writeAuditLog } from "@/lib/audit";
import { ApiError } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/auth/google/callback — Google gọi lại sau khi admin đồng ý.
export async function GET(req: NextRequest) {
  const settingsUrl = new URL("/admin/settings", req.nextUrl.origin);
  try {
    const guard = await requireApi(["admin"]);
    if (guard instanceof NextResponse) return guard;
    const session = guard;

    const code = req.nextUrl.searchParams.get("code");
    const oauthErr = req.nextUrl.searchParams.get("error");
    if (oauthErr || !code) {
      // Google từ chối ngay (vd access_denied) — truyền lý do để admin thấy.
      settingsUrl.searchParams.set("google", "error");
      settingsUrl.searchParams.set("reason", oauthErr || "no_code");
      return NextResponse.redirect(settingsUrl);
    }

    await exchangeAndStore(req.nextUrl.origin, code);
    await writeAuditLog({
      actorId: session.userId,
      action: "drive_oauth.connected",
      entityType: "app_settings",
    });

    settingsUrl.searchParams.set("google", "connected");
    return NextResponse.redirect(settingsUrl);
  } catch (e) {
    // Lỗi khi đổi code lấy token (vd redirect_uri_mismatch, invalid_client,
    // NO_REFRESH_TOKEN). Truyền message ngắn để admin tự chẩn đoán; log đầy đủ.
    console.error("[google-callback] exchange failed:", e);
    const reason =
      e instanceof ApiError
        ? e.code || e.message
        : e instanceof Error
          ? e.message.slice(0, 160)
          : "unknown";
    settingsUrl.searchParams.set("google", "error");
    settingsUrl.searchParams.set("reason", reason);
    return NextResponse.redirect(settingsUrl);
  }
}
