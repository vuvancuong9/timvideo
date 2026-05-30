import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/database.types";

export type AuditEntry = {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
};

/**
 * Ghi audit log bằng service role (RLS chặn user thường ghi vào audit_logs).
 * Không bao giờ làm fail request chính nếu ghi log lỗi.
 */
export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  try {
    const admin = createSupabaseAdminClient();
    await admin.from("audit_logs").insert({
      actor_id: entry.actorId ?? null,
      action: entry.action,
      entity_type: entry.entityType,
      entity_id: entry.entityId ?? null,
      before_data: (entry.before ?? null) as Json,
      after_data: (entry.after ?? null) as Json,
    });
  } catch (err) {
    console.error("[audit] write failed:", err);
  }
}
