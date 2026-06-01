import { NextRequest, NextResponse } from "next/server";
import { requireApi } from "@/lib/auth/session";
import { getThresholds, saveThresholds } from "@/lib/video-review/policy-config";
import {
  getRiskGroups,
  saveRiskGroups,
} from "@/lib/video-review/policy-groups-config";
import {
  getConfidenceRule,
  saveConfidenceRule,
} from "@/lib/video-review/confidence-config";
import { writeAuditLog } from "@/lib/audit";
import { handleApiError, jsonOk, readJson } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/admin/policy-rules — ngưỡng + nhóm rủi ro + luật confidence. CHỈ admin.
export async function GET() {
  try {
    const guard = await requireApi(["admin"]);
    if (guard instanceof NextResponse) return guard;
    const [thresholds, riskGroups, confidenceRule] = await Promise.all([
      getThresholds(),
      getRiskGroups(),
      getConfidenceRule(),
    ]);
    return jsonOk({ thresholds, riskGroups, confidenceRule });
  } catch (e) {
    return handleApiError(e);
  }
}

// PUT /api/admin/policy-rules — cập nhật ngưỡng / nhóm rủi ro / confidence. CHỈ admin.
export async function PUT(req: NextRequest) {
  try {
    const guard = await requireApi(["admin"]);
    if (guard instanceof NextResponse) return guard;
    const session = guard;

    const body = await readJson<Record<string, unknown>>(req);

    // Tương thích form ngưỡng cũ: body KHÔNG bọc slice → coi cả body là thresholds.
    if (body.riskGroups === undefined && body.confidenceRule === undefined) {
      const thresholds = await saveThresholds(body, session.userId);
      await writeAuditLog({
        actorId: session.userId,
        action: "policy_rules.update",
        entityType: "app_settings",
        after: { thresholds },
      });
      return jsonOk({ thresholds });
    }

    const after: Record<string, unknown> = {};
    const out: Record<string, unknown> = {};
    if (body.riskGroups !== undefined) {
      const riskGroups = await saveRiskGroups(body.riskGroups, session.userId);
      out.riskGroups = riskGroups;
      after.riskGroups = riskGroups;
    }
    if (body.confidenceRule !== undefined) {
      const confidenceRule = await saveConfidenceRule(
        body.confidenceRule,
        session.userId,
      );
      out.confidenceRule = confidenceRule;
      after.confidenceRule = confidenceRule;
    }

    await writeAuditLog({
      actorId: session.userId,
      action: "policy_rules.update",
      entityType: "app_settings",
      after,
    });

    return jsonOk(out);
  } catch (e) {
    return handleApiError(e);
  }
}
