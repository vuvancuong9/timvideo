import { getOptionalSession } from "@/lib/auth/session";
import { jsonError, jsonOk } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getOptionalSession();
  if (!session) return jsonError(401, "Chưa đăng nhập", "UNAUTHENTICATED");
  return jsonOk({
    id: session.userId,
    email: session.email,
    role: session.role,
    profile: session.profile,
  });
}
