import { NextRequest, NextResponse } from "next/server";
import { requireApi } from "@/lib/auth/session";
import { exchangeAndStore } from "@/lib/drive-oauth";
import { writeAuditLog } from "@/lib/audit";

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
    const err = req.nextUrl.searchParams.get("error");
    if (err || !code) {
      settingsUrl.searchParams.set("google", "error");
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
  } catch {
    settingsUrl.searchParams.set("google", "error");
    return NextResponse.redirect(settingsUrl);
  }
}
